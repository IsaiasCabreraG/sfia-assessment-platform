"""Acceso a PostgreSQL con psycopg (SQL directo, sin ORM).

Cada petición HTTP recibe una conexión del pool mediante la dependencia `get_conn`: se confirma
(commit) si el endpoint termina bien y se revierte (rollback) si lanza una excepción.
"""
from collections.abc import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from shared.config import env

_pool: ConnectionPool | None = None


def _dsn() -> str:
    return (
        f"host={env('DB_HOST', 'localhost')} port={env('DB_PORT', '5432')} "
        f"dbname={env('DB_NAME')} user={env('DB_USER')} password={env('DB_PASSWORD')}"
    )


def get_pool() -> ConnectionPool:
    """Crea el pool la primera vez que se necesita y lo reutiliza después."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(_dsn(), min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)
    return _pool


def get_conn() -> Iterator[psycopg.Connection]:
    """Dependencia de FastAPI: una conexión por petición, con commit/rollback automático."""
    with get_pool().connection() as conn:
        yield conn


def connect() -> psycopg.Connection:
    """Conexión suelta (con filas como diccionarios) para scripts fuera de FastAPI."""
    return psycopg.connect(_dsn(), row_factory=dict_row)
