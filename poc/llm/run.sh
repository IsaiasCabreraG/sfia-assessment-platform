#!/usr/bin/env bash
# Levanta el módulo LLM (puerto 8002): crea el entorno virtual y el .env si faltan,
# instala las dependencias si cambiaron y arranca uvicorn.
#
#     bash poc/llm/run.sh              # desde la raíz del repositorio
#     PORT=8010 bash poc/llm/run.sh    # en otro puerto
set -eo pipefail
cd "$(dirname "$0")"
source ../lib.sh
levantar_modulo poc-llm 8002
