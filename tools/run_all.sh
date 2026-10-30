#!/usr/bin/env bash
# Levanta de una vez los módulos que todavía no estén corriendo: identity, catalog, llm, content y los
# portales (web). Los que ya corren se omiten y no se tocan. Muestra el log de lo que inició y, con Ctrl+C, lo detiene.
#
#   bash tools/run_all.sh               inicia lo que falte
#   bash tools/run_all.sh --reiniciar   detiene todo lo de estos puertos y lo inicia de nuevo (necesario tras cambiar código)
#   bash tools/run_all.sh --detener     detiene todo lo de estos puertos y termina
#
# Puertos: identity 8001, catalog 8002, llm 8003, content 8004, web 5173. Para pruebas se pueden cambiar con
# PORT_IDENTITY, PORT_CATALOG, PORT_LLM, PORT_CONTENT y PORT_WEB (el login con Google solo funciona en los puertos
# por defecto, porque son los registrados en Google).
set -eo pipefail
cd "$(dirname "$0")/.."
source tools/lib.sh

MODO="${1:-}"
case "$MODO" in ""|--reiniciar|--detener) ;; *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;; esac

declare -A PUERTO=( [identity]="${PORT_IDENTITY:-8001}" [catalog]="${PORT_CATALOG:-8002}" [llm]="${PORT_LLM:-8003}"
                    [content]="${PORT_CONTENT:-8004}" [web]="${PORT_WEB:-5173}" )
ORDEN=(identity catalog llm content web)
LOGS="tools/logs"

escucha() { ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN; }

# Cierra lo que escuche en el puerto (los procesos hijos de `npx` sobreviven a un kill simple, por eso se busca por puerto).
cerrar_puerto() {
    local pid
    for pid in $(ss -ltnp "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2); do
        kill "$pid" 2>/dev/null || true
    done
}

if [ "$MODO" = "--detener" ] || [ "$MODO" = "--reiniciar" ]; then
    for m in "${ORDEN[@]}"; do
        if escucha "${PUERTO[$m]}"; then cerrar_puerto "${PUERTO[$m]}"; echo "detenido: $m (:${PUERTO[$m]})"; fi
    done
    sleep 2
    [ "$MODO" = "--detener" ] && exit 0
fi

preparar_entorno
cargar_env
exportar_pythonpath

# Si se cambió algún puerto, los módulos deben apuntarse entre sí con los nuevos.
if [ -n "${PORT_IDENTITY}${PORT_CATALOG}${PORT_LLM}${PORT_CONTENT}${PORT_WEB}" ]; then
    export CORS_ORIGINS="http://localhost:${PUERTO[web]}" LLM_URL="http://localhost:${PUERTO[llm]}"
    export CATALOG_URL="http://localhost:${PUERTO[catalog]}"
    export PORTAL_DOCENTE_URL="http://localhost:${PUERTO[web]}/docente/" PORTAL_VALIDADOR_URL="http://localhost:${PUERTO[web]}/validador/"
    export NEXT_PUBLIC_IDENTITY_URL="http://localhost:${PUERTO[identity]}" NEXT_PUBLIC_CATALOG_URL="http://localhost:${PUERTO[catalog]}"
    export NEXT_PUBLIC_CONTENT_URL="http://localhost:${PUERTO[content]}"
    [ "${PUERTO[web]}" != 5173 ] && export NEXT_DIST_DIR=".next-${PUERTO[web]}"
fi

# Avisos que evitan perder tiempo buscando un fallo que ya se conoce.
if command -v pg_isready >/dev/null && ! pg_isready -q -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}"; then
    echo "AVISO: PostgreSQL no responde en ${DB_HOST:-localhost}:${DB_PORT:-5432}. Inícialo con:  sudo service postgresql start"
fi
if [ "${LLM_PROVIDER:-cli}" = "groq" ] && [ -z "${GROQ_API_KEY:-}" ]; then
    echo "AVISO: LLM_PROVIDER=groq pero falta GROQ_API_KEY en .env: generar ítems fallará hasta que la completes."
fi

mkdir -p "$LOGS"
declare -A ESTADO
INICIADOS=()
for m in "${ORDEN[@]}"; do
    if escucha "${PUERTO[$m]}"; then
        ESTADO[$m]="ya corría (se omite)"
        continue
    fi
    : > "$LOGS/$m.log"
    if [ "$m" = web ]; then
        PORT="${PUERTO[web]}" bash web/management-portal/run.sh >> "$LOGS/$m.log" 2>&1 &
    else
        "$VENV/bin/uvicorn" "$m.main:app" --port "${PUERTO[$m]}" >> "$LOGS/$m.log" 2>&1 &
    fi
    INICIADOS+=("$m")
done

# Espera a que cada módulo iniciado responda (el portal tarda más: compila la primera vez).
for m in "${INICIADOS[@]}"; do
    url="http://localhost:${PUERTO[$m]}/health"; limite=40
    [ "$m" = web ] && { url="http://localhost:${PUERTO[web]}/docente/"; limite=120; }
    ESTADO[$m]="falló (ver $LOGS/$m.log)"
    for _ in $(seq 1 "$limite"); do
        if curl -sf -o /dev/null "$url"; then ESTADO[$m]="iniciado"; break; fi
        sleep 1
    done
done

echo
printf "%-10s %-7s %s\n" MÓDULO PUERTO ESTADO
for m in "${ORDEN[@]}"; do printf "%-10s %-7s %s\n" "$m" "${PUERTO[$m]}" "${ESTADO[$m]}"; done
echo
echo "Portales:  http://localhost:${PUERTO[web]}/docente/   http://localhost:${PUERTO[web]}/validador/"

if [ ${#INICIADOS[@]} -eq 0 ]; then
    echo "Todo estaba corriendo. Si cambiaste código, usa:  bash tools/run_all.sh --reiniciar"
    exit 0
fi
for m in "${INICIADOS[@]}"; do
    if [[ "${ESTADO[$m]}" == falló* ]]; then echo; echo "--- últimas líneas de $LOGS/$m.log ---"; tail -n 8 "$LOGS/$m.log"; fi
done

detener() {
    echo; echo ">> Deteniendo lo que inició este script…"
    for m in "${INICIADOS[@]}"; do cerrar_puerto "${PUERTO[$m]}"; done
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap detener INT TERM
echo ">> Ctrl+C detiene lo que inició este script (no toca lo que ya corría). Log en vivo:"
echo
for m in "${INICIADOS[@]}"; do
    tail -n 0 -F "$LOGS/$m.log" 2>/dev/null | sed -u "s/^/[$m] /" &
done
wait
