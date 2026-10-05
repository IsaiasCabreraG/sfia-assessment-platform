#!/usr/bin/env bash
# Levanta el módulo de autenticación (Authlib, puerto 8001): crea el entorno virtual y el
# .env si faltan, instala las dependencias si cambiaron y arranca uvicorn.
#
#     bash poc/auth/authlib/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib.sh
levantar_modulo poc-auth-authlib 8001 GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET JWT_SECRET SESSION_SECRET
