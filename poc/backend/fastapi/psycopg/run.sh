#!/usr/bin/env bash
# Levanta el backend FastAPI + psycopg (puerto 8000): crea el entorno virtual y el .env si
# faltan, instala las dependencias si cambiaron y arranca uvicorn.
# Detén antes la otra variante del backend: ambas usan el puerto 8000.
#
#     bash poc/backend/fastapi/psycopg/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../../lib.sh
levantar_modulo poc-backend-psycopg 8000 JWT_SECRET POC_DB_PASSWORD
