#!/usr/bin/env bash
# Pruebas E2E del Portal Docente (generación y sesión con refresh token) en un navegador real (Playwright). Levanta su propia copia de los módulos
# y del portal en puertos alternativos (9001-9004 y 5199), con una IA simulada, así que no toca lo que
# tengas corriendo ni gasta tu sesión de Claude. Los datos de prueba se borran al terminar.
#
# Desde la raíz del proyecto:   bash tests/e2e/run_e2e.sh
set -eo pipefail
cd "$(dirname "$0")/../.."
source tools/lib.sh
preparar_entorno
cargar_env
exportar_pythonpath
LOG="$(mktemp -d)"; PIDS=()
# Cierra lo que escucha en los puertos de la prueba (los procesos hijos de `npx` sobreviven a un kill simple).
cerrar_puertos() {
    local pid p
    for p in 5199 9001 9002 9003 9004; do
        for pid in $(ss -ltnp 2>/dev/null | grep ":$p " | grep -oE 'pid=[0-9]+' | cut -d= -f2); do kill "$pid" 2>/dev/null || true; done
    done
}
limpiar() {
    for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
    cerrar_puertos
    sleep 1; rm -rf web/management-portal/.next-e2e 2>/dev/null || true
    "$VENV/bin/python" -c "from tests.conftest import _cleanup; _cleanup()" 2>/dev/null || true
}
trap limpiar EXIT
cerrar_puertos   # por si quedó algo de una corrida anterior
sleep 1

export CORS_ORIGINS="http://localhost:5199" LLM_URL="http://localhost:9003"
export LLM_PROVIDER=cli   # la prueba usa la IA simulada, aunque el .env apunte a Groq
export LLM_CLI_COMMAND="python3 $PWD/tests/e2e/fake_llm_cli.py"
declare -A PUERTOS=( [identity]=9001 [catalog]=9002 [llm]=9003 [content]=9004 )
for m in identity catalog llm content; do
    "$VENV/bin/uvicorn" "$m.main:app" --port "${PUERTOS[$m]}" >"$LOG/$m.log" 2>&1 &
    PIDS+=($!)
done

( cd web/management-portal
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; set +e; source "$NVM_DIR/nvm.sh"; set -e
  NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_IDENTITY_URL=http://localhost:9001 NEXT_PUBLIC_CATALOG_URL=http://localhost:9002 \
  NEXT_PUBLIC_CONTENT_URL=http://localhost:9004 npx next dev -p 5199 >"$LOG/next.log" 2>&1 ) &
PIDS+=($!)

echo ">> Esperando los servidores…"
for _ in $(seq 1 60); do
    ok=1
    for p in 9001 9002 9003 9004; do curl -sf "http://localhost:$p/health" >/dev/null || ok=0; done
    curl -sf "http://localhost:5199/docente/" >/dev/null || ok=0
    [ $ok = 1 ] && break
    sleep 1
done
[ $ok = 1 ] || { echo "Los servidores no arrancaron; logs en $LOG" >&2; tail -5 "$LOG"/*.log >&2; exit 1; }

"$VENV/bin/python" tests/e2e/make_token.py "$LOG/sesiones.json"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; set +e; source "$NVM_DIR/nvm.sh"; set -e
node tests/e2e/generar.mjs http://localhost:5199 "$LOG/sesiones.json"
node tests/e2e/sesion.mjs http://localhost:5199 "$LOG/sesiones.json"
