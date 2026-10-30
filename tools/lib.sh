# Funciones comunes de los scripts. No se ejecuta directamente.
# Todos los scripts parten de la raíz del proyecto (.env, requirements.txt y pytest.ini están ahí).

ENTORNO="sprint1"
WORKON_HOME="${WORKON_HOME:-$HOME/.virtualenvs}"
VENV="$WORKON_HOME/$ENTORNO"

# Los paquetes Python viven en carpetas distintas (modules/<módulo>/<paquete>): se ven todos desde PYTHONPATH.
# La raíz va primero para que también se pueda importar `tests`.
exportar_pythonpath() {
    export PYTHONPATH="$PWD:$PWD/modules/identity:$PWD/modules/catalog-sfia:$PWD/modules/content-generation:$PWD/modules/llm-gateway:$PWD/modules/shared"
}

# Crea el entorno virtual (virtualenvwrapper) si falta e instala las dependencias si cambiaron.
preparar_entorno() {
    if [ ! -d "$VENV" ]; then
        echo ">> Creando entorno virtual '$ENTORNO'"
        # virtualenvwrapper no es compatible con `set -e`: se desactiva mientras crea el entorno.
        set +e
        export VIRTUALENVWRAPPER_PYTHON=/usr/bin/python3
        source /usr/share/virtualenvwrapper/virtualenvwrapper.sh
        mkvirtualenv -p /usr/bin/python3 "$ENTORNO"
        deactivate
        set -e
    fi
    local marca="$VENV/.requirements.sha256" hash
    hash="$(sha256sum requirements.txt | cut -d' ' -f1)"
    if [ ! -f "$marca" ] || [ "$(cat "$marca")" != "$hash" ]; then
        echo ">> Instalando dependencias"
        "$VENV/bin/pip" install -q -r requirements.txt
        echo "$hash" > "$marca"
    fi
}

# Exige .env (lo crea desde .env.example si falta) y lo exporta al entorno.
cargar_env() {
    if [ ! -f .env ]; then
        cp .env.example .env
        echo ">> Se creó .env a partir de .env.example; complétalo" >&2
        exit 1
    fi
    set -a; source .env; set +a
}
