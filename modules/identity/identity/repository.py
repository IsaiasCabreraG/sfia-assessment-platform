"""Capa de datos de identity: consultas SQL sobre `identity.users` y `identity.user_roles`."""
from uuid import UUID

PENDING_PREFIX = "pending:"  # google_id provisional de un usuario cuyo rol se asignó antes de su primer login


def find_by_google_id(cur, google_id: str) -> dict | None:
    cur.execute("SELECT * FROM identity.users WHERE google_id = %s", (google_id,))
    return cur.fetchone()


def find_by_email(cur, email: str) -> dict | None:
    cur.execute("SELECT * FROM identity.users WHERE lower(email) = lower(%s)", (email,))
    return cur.fetchone()


def insert_user(cur, google_id: str, email: str, name: str | None, avatar: str | None) -> dict:
    cur.execute(
        "INSERT INTO identity.users (google_id, email, name, avatar) VALUES (%s, %s, %s, %s) RETURNING *",
        (google_id, email, name, avatar),
    )
    return cur.fetchone()


def update_profile(cur, user_id: UUID, google_id: str, name: str | None, avatar: str | None) -> dict:
    """Actualiza el perfil con los datos de Google (y fija el google_id real si era provisional)."""
    cur.execute(
        "UPDATE identity.users SET google_id = %s, name = %s, avatar = %s WHERE id = %s RETURNING *",
        (google_id, name, avatar, user_id),
    )
    return cur.fetchone()


def get_roles(cur, user_id: UUID) -> list[str]:
    cur.execute("SELECT role FROM identity.user_roles WHERE user_id = %s ORDER BY role", (user_id,))
    return [r["role"] for r in cur.fetchall()]


def insert_role(cur, user_id: UUID, role: str) -> None:
    cur.execute(
        "INSERT INTO identity.user_roles (user_id, role) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (user_id, role),
    )


def delete_role(cur, user_id: UUID, role: str) -> None:
    cur.execute("DELETE FROM identity.user_roles WHERE user_id = %s AND role = %s", (user_id, role))


# ---------- Refresh tokens ----------


def insert_refresh_token(cur, user_id: UUID, token_hash: str, expires_at) -> None:
    cur.execute(
        "INSERT INTO identity.refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user_id, token_hash, expires_at),
    )


def find_refresh_token(cur, token_hash: str) -> dict | None:
    cur.execute("SELECT * FROM identity.refresh_tokens WHERE token_hash = %s", (token_hash,))
    return cur.fetchone()


def revoke_refresh_token(cur, token_id: UUID) -> None:
    cur.execute("UPDATE identity.refresh_tokens SET revoked_at = now() WHERE id = %s AND revoked_at IS NULL",
                (token_id,))


def get_user(cur, user_id: UUID) -> dict | None:
    cur.execute("SELECT * FROM identity.users WHERE id = %s", (user_id,))
    return cur.fetchone()
