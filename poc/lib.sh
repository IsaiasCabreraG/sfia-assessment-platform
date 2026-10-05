# Funciones comunes de los run.sh de los módulos Python. No se ejecuta directamente.

WORKON_HOME="${WORKON_HOME:-$HOME/.virtualenvs}"

cargar_virtualenvwrapper() {
    local f
    # Usar siempre el Python del sistema, aunque haya otro entorno virtual activo.
    export VIRTUALENVWRAPPER_PYTHON=/usr/bin/python3
    for f in /usr/share/virtualenvwrapper/virtualenvwrapper.sh /usr/local/bin/virtualenvwrapper.sh; do
        if [ -f "$f" ]; then
            source "$f"
            return
        fi
    done
    echo "No se encontró virtualenvwrapper.sh (instala: sudo apt install virtualenvwrapper)" >&2
    exit 1
}

# Uso: levantar_modulo <entorno> <puerto> [variables obligatorias del .env...]
# Se llama desde la carpeta del módulo (donde están main.py, requirements.txt y .env.example).
levantar_modulo() {
    local entorno="$1" puerto="$2"
    shift 2
    local venv="$WORKON_HOME/$entorno"

    # 1) Entorno virtual
    if [ ! -d "$venv" ]; then
        echo ">> Creando entorno virtual '$entorno'"
        # virtualenvwrapper no es compatible con `set -e`: se desactiva mientras crea el entorno.
        set +e
        cargar_virtualenvwrapper
        mkvirtualenv -p /usr/bin/python3 "$entorno"
        deactivate
        set -e
        if [ ! -x "$venv/bin/pip" ]; then
            echo "No se pudo crear el entorno '$entorno'" >&2
            exit 1
        fi
    fi

    # 2) Dependencias (se reinstalan si requirements.txt cambió)
    local marca="$venv/.requirements.sha256"
    local hash
    hash="$(sha256sum requirements.txt | cut -d' ' -f1)"
    if [ ! -f "$marca" ] || [ "$(cat "$marca")" != "$hash" ]; then
        echo ">> Instalando dependencias"
        "$venv/bin/pip" install -r requirements.txt
        echo "$hash" > "$marca"
    fi

    # 3) .env
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

    # 4) Arranque
    echo ">> Levantando '$entorno' en el puerto ${PORT:-$puerto}"
    exec "$venv/bin/uvicorn" main:app --port "${PORT:-$puerto}"
}
