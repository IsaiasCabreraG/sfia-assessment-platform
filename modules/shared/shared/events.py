"""Event store: los módulos registran eventos de dominio en `events.events` (patrón de modules.md)."""
from uuid import UUID

from psycopg.types.json import Jsonb


def emit_event(cur, type: str, aggregate_id: UUID | None, payload: dict) -> None:
    """Inserta un evento en la misma transacción que el cambio que lo origina."""
    cur.execute(
        "INSERT INTO events.events (type, aggregate_id, payload) VALUES (%s, %s, %s)",
        (type, aggregate_id, Jsonb(payload)),
    )
