#!/usr/bin/env bash
# Levanta el backend del prototipo (FastAPI, puerto 8003): crea el entorno virtual y el .env si
# faltan, instala las dependencias si cambiaron y arranca uvicorn.
# Con MOCK=1 (en el .env o al lanzar) devuelve borradores falsos sin llamar al LLM.
#
#     bash poc/prototipo/backend/run.sh          # desde la raíz del repositorio
#     MOCK=1 bash poc/prototipo/backend/run.sh   # sin LLM
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib.sh
levantar_modulo poc-prototipo 8003
