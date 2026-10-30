#!/usr/bin/env bash
# Ejecuta un script Python con el entorno del proyecto (PYTHONPATH con todos los módulos y `shared`).
# Uso: bash tools/run_python.sh ruta/script.py [argumentos...]
set -euo pipefail
cd "$(dirname "$0")/.."
source tools/lib.sh
preparar_entorno
cargar_env
exportar_pythonpath
exec "$VENV/bin/python" "$@"
