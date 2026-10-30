#!/usr/bin/env bash
# Crea el rol y la base de datos, aplica schema.sql y carga el catálogo SFIA.
# Requiere sudo (usa el usuario postgres para crear el rol y la BD). Lee la configuración de .env.
#
# Desde la raíz del proyecto:
#     cp .env.example .env     # solo la primera vez; completa los valores
#     bash db/setup.sh         # pide la clave de sudo
#
# Es idempotente: se puede volver a correr sin duplicar datos.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a

sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -v dbname="$DB_NAME" -v dbuser="$DB_USER" -v dbpass="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'dbuser', :'dbpass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'dbuser') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'dbuser')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname') \gexec
SQL

PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f db/schema.sql

# El catálogo se carga con Python (necesita el entorno virtual del proyecto).
bash tools/run_python.sh db/seed_catalog.py

echo "BD '$DB_NAME' lista."
