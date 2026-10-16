#!/usr/bin/env bash
# Levanta el frontend del revisor (React + Vite, puerto 5181). Necesita el backend del prototipo (8003).
#
#     bash poc/prototipo/revisor/run.sh     # desde la raíz del repositorio
set -eo pipefail
cd "$(dirname "$0")"
source ../../lib_node.sh
levantar_modulo_node prototipo-revisor 5181
