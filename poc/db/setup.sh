#!/usr/bin/env bash
# Crea el rol y la base de datos de la PoC y aplica schema.sql.
# Requiere sudo (usa el usuario postgres). Lee la configuración de poc/db/.env.
#
# Cómo correrlo (desde la raíz del repositorio):
#
#     cp poc/db/.env.example poc/db/.env    # solo la primera vez; edita la contraseña
#     bash poc/db/setup.sh                  # pide la clave de sudo
#
# Es idempotente: se puede volver a correr para reaplicar schema.sql.
set -euo pipefail
cd "$(dirname "$0")"

set -a; source .env; set +a

sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -v dbname="$POC_DB_NAME" -v dbuser="$POC_DB_USER" -v dbpass="$POC_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'dbuser', :'dbpass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'dbuser') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'dbuser')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname') \gexec
SQL

PGPASSWORD="$POC_DB_PASSWORD" psql -v ON_ERROR_STOP=1 \
    -h "$POC_DB_HOST" -p "$POC_DB_PORT" -U "$POC_DB_USER" -d "$POC_DB_NAME" \
    -f schema.sql

echo "BD '$POC_DB_NAME' lista."
