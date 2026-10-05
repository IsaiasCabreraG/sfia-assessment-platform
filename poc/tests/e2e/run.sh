#!/usr/bin/env bash
# Ejecuta la prueba E2E de la interfaz (Playwright + Chromium sin ventana).
#
#     bash poc/tests/e2e/run.sh                                   # contra el frontend en http://localhost:5173
#     FRONTEND_URL=http://localhost:5174 bash poc/tests/e2e/run.sh
#     bash poc/tests/e2e/run.sh --grep "formulario"               # solo una prueba
#
# Requiere corriendo: la BD, un backend (8000), un frontend (5173) y, para la prueba de la IA,
# el LLM (8002). La primera vez descarga Chromium (~150 MB). Si el navegador no arranca por faltar
# librerías del sistema, instálalas una vez con:
#     cd poc/tests/e2e && sudo env "PATH=$PATH" npx playwright install-deps chromium
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib_node.sh
cargar_nvm

if [ ! -f node_modules/.package-lock.json ] || [ package.json -nt node_modules/.package-lock.json ]; then
    echo ">> Instalando dependencias"
    npm install
fi
npx playwright install chromium

exec npm start -- "$@"
