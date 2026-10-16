#!/usr/bin/env bash
# Levanta el frontend del prototipo (React + Vite, puerto 5180): instala las dependencias
# si hace falta y arranca el servidor de desarrollo. Las llamadas a /api van al backend (8003).
#
#     bash poc/prototipo/frontend/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib_node.sh
levantar_modulo_node prototipo-frontend 5180
