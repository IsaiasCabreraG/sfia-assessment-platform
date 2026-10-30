"""Reglas de negocio de identity: login con Google, sesión (access + refresh token) y roles (lista blanca)."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from shared.config import env
from shared.errors import BadRequest, Unauthorized
from shared.events import emit_event
from shared.security import ROLES, create_access_token

from identity import repository


def _hash(token: str) -> str:
    """El refresh token se guarda solo como hash: si se filtra la BD, los tokens no sirven."""
    return hashlib.sha256(token.encode()).hexdigest()


def _start_session(cur, user: dict) -> tuple[str, str]:
    """Emite un access token (JWT, corto, con los roles vigentes) y un refresh token nuevo (largo, opaco)."""
    roles = repository.get_roles(cur, user["id"])
    access = create_access_token(user["id"], user["email"], user["name"], roles)
    refresh = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(seconds=int(env("REFRESH_TTL_SECONDS", "604800")))
    repository.insert_refresh_token(cur, user["id"], _hash(refresh), expires)
    return access, refresh


def login_with_google(cur, profile: dict) -> tuple[dict, str, str]:
    """Registra o actualiza al usuario con su perfil de Google y emite su JWT.

    `profile` es el `userinfo` de Google (sub, email, email_verified, name, picture).
    Iniciar sesión NO da acceso a ningún portal: los roles salen de `identity.user_roles`.
    Devuelve (usuario, access token, refresh token).
    """
    if not profile.get("email_verified", False):
        raise BadRequest("La cuenta de Google no tiene el correo verificado")

    google_id, email = profile["sub"], profile["email"]
    name, avatar = profile.get("name"), profile.get("picture")

    user = repository.find_by_google_id(cur, google_id)
    if user:
        user = repository.update_profile(cur, user["id"], google_id, name, avatar)
    else:
        existing = repository.find_by_email(cur, email)
        if existing and existing["google_id"].startswith(repository.PENDING_PREFIX):
            # Usuario con rol asignado antes de su primer login: se completa con el google_id real.
            user = repository.update_profile(cur, existing["id"], google_id, name, avatar)
        else:
            user = repository.insert_user(cur, google_id, email, name, avatar)
            emit_event(cur, "UserRegistered", user["id"],
                       {"user_id": str(user["id"]), "email": email, "google_id": google_id})

    access, refresh = _start_session(cur, user)
    return user, access, refresh


def refresh_session(cur, refresh_token: str) -> tuple[str, str]:
    """Cambia un refresh token válido por un access token nuevo y un refresh token nuevo (rotación).

    El refresh token usado queda revocado: sirve una sola vez. Los roles del nuevo access token
    se leen de la BD, así que un rol asignado o quitado se aplica al renovar la sesión.
    """
    row = repository.find_refresh_token(cur, _hash(refresh_token))
    ahora = datetime.now(timezone.utc)
    if row is None or row["revoked_at"] is not None or row["expires_at"] <= ahora:
        raise Unauthorized("Sesión vencida: vuelve a iniciar sesión")
    user = repository.get_user(cur, row["user_id"])
    repository.revoke_refresh_token(cur, row["id"])
    return _start_session(cur, user)


def logout(cur, refresh_token: str) -> None:
    """Revoca el refresh token (si existe); el access token vence solo."""
    row = repository.find_refresh_token(cur, _hash(refresh_token))
    if row is not None:
        repository.revoke_refresh_token(cur, row["id"])


def grant_role(cur, email: str, role: str) -> dict:
    """Agrega `role` al usuario con ese correo (lo crea como provisional si aún no inició sesión)."""
    if role not in ROLES:
        raise BadRequest(f"Rol inválido: {role}. Válidos: {', '.join(ROLES)}")
    user = repository.find_by_email(cur, email)
    if user is None:
        user = repository.insert_user(cur, f"{repository.PENDING_PREFIX}{email}", email, None, None)
    repository.insert_role(cur, user["id"], role)
    return user


def revoke_role(cur, email: str, role: str) -> None:
    user = repository.find_by_email(cur, email)
    if user is None:
        raise BadRequest(f"No existe el usuario {email}")
    repository.delete_role(cur, user["id"], role)


def user_with_roles(cur, user_id) -> dict:
    """Usuario y roles vigentes en la BD (para `/auth/me`)."""
    cur.execute("SELECT id, email, name, avatar FROM identity.users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    if user is None:
        raise BadRequest("Usuario inexistente")
    return {**user, "roles": repository.get_roles(cur, user_id)}
