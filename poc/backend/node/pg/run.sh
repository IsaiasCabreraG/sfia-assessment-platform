#!/usr/bin/env bash
# Levanta el backend Node + Express + pg (puerto 8000): instala las dependencias si hace falta,
# crea el .env si falta y arranca el servidor.
# Detén antes las otras variantes del backend: todas usan el puerto 8000.
#
#     bash poc/backend/node/pg/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../../lib_node.sh
levantar_modulo_node poc-backend-node-pg 8000 JWT_SECRET POC_DB_PASSWORD
