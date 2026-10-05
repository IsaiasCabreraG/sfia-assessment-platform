#!/usr/bin/env bash
# Levanta el frontend Vue + Vite (puerto 5173): instala las dependencias si hace falta,
# crea el .env si falta y arranca el servidor de desarrollo.
# Detén antes el otro frontend (React): ambos usan el puerto 5173.
#
#     bash poc/frontend/vue/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib_node.sh
levantar_modulo_node poc-frontend-vue 5173
