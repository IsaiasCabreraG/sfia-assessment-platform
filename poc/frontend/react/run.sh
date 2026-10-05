#!/usr/bin/env bash
# Levanta el frontend React + Vite (puerto 5173): instala las dependencias si hace falta,
# crea el .env si falta y arranca el servidor de desarrollo.
# Detén antes el otro frontend (Vue): ambos usan el puerto 5173.
#
#     bash poc/frontend/react/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib_node.sh
levantar_modulo_node poc-frontend-react 5173
