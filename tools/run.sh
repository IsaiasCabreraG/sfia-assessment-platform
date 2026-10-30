#!/usr/bin/env bash
# Levanta un módulo del backend.  Uso: bash tools/run.sh identity|catalog|llm|content
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/lib.sh

declare -A PUERTOS=( [identity]=8001 [catalog]=8002 [llm]=8003 [content]=8004 )
modulo="${1:-}"
if [ -z "$modulo" ] || [ -z "${PUERTOS[$modulo]:-}" ]; then
    echo "Uso: bash tools/run.sh identity|catalog|llm|content" >&2
    exit 1
fi

preparar_entorno
cargar_env
exportar_pythonpath
echo ">> Levantando '$modulo' en el puerto ${PUERTOS[$modulo]}"
exec "$VENV/bin/uvicorn" "$modulo.main:app" --port "${PUERTOS[$modulo]}"
