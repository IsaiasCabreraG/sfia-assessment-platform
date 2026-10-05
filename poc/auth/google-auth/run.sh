#!/usr/bin/env bash
# Levanta el módulo de autenticación (google-auth, puerto 8001): crea el entorno virtual y
# el .env si faltan, instala las dependencias si cambiaron y arranca uvicorn.
#
#     bash poc/auth/google-auth/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib.sh
levantar_modulo poc-auth-google 8001 GOOGLE_CLIENT_ID JWT_SECRET
