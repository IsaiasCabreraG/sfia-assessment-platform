#!/usr/bin/env bash
# Levanta los dos portales con Next.js (puerto 5173): instala dependencias si hace falta.
#   Portal Docente/Reclutador: http://localhost:5173/docente/
#   Portal Validador:          http://localhost:5173/validador/
set -eo pipefail
cd "$(dirname "$0")"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +e; source "$NVM_DIR/nvm.sh"; set -e   # nvm no es compatible con `set -e`
if [ ! -f node_modules/.package-lock.json ] || [ package.json -nt node_modules/.package-lock.json ]; then
    echo ">> Instalando dependencias"
    npm install
fi
exec npm run dev
