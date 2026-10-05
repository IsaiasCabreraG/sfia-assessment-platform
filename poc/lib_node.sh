# Funciones comunes de los run.sh de los módulos Node. No se ejecuta directamente.

cargar_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        echo "No se encontró nvm en $NVM_DIR (ver https://github.com/nvm-sh/nvm)" >&2
        exit 1
    fi
    # nvm no es compatible con `set -e`: se desactiva mientras se carga.
    set +e
    source "$NVM_DIR/nvm.sh"
    set -e
    if ! command -v node >/dev/null 2>&1; then
        echo "nvm no tiene una versión de Node por defecto (corre: nvm install --lts)" >&2
        exit 1
    fi
}

# Uso: levantar_modulo_node <nombre> <puerto> [variables obligatorias del .env...]
# Se llama desde la carpeta del módulo (donde están main.ts, package.json y .env.example).
levantar_modulo_node() {
    local nombre="$1" puerto="$2"
    shift 2
    cargar_nvm

    # 1) Dependencias (se reinstalan si package.json cambió)
    if [ ! -f node_modules/.package-lock.json ] || [ package.json -nt node_modules/.package-lock.json ]; then
        echo ">> Instalando dependencias"
        npm install
    fi

    # 2) .env
    if [ ! -f .env ]; then
        cp .env.example .env
        echo ">> Se creó .env a partir de .env.example"
    fi
    local faltan=() v valor
    for v in "$@"; do
        valor="$(grep -E "^$v=" .env | head -1 | cut -d= -f2-)"
        if [ -z "$valor" ]; then
            faltan+=("$v")
        fi
    done
    if [ ${#faltan[@]} -gt 0 ]; then
        echo "Completa en $(pwd)/.env: ${faltan[*]}" >&2
        exit 1
    fi

    # 3) Arranque
    export PORT="${PORT:-$puerto}"
    echo ">> Levantando '$nombre' en el puerto $PORT"
    exec npm start
}
