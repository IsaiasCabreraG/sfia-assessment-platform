"""JWT HS256 (emisión y validación) y control de acceso por rol.

El módulo identity emite el token con `create_access_token`; todos los módulos lo validan
localmente con `current_user` y `require_roles`, sin consultar a identity.
"""
import time
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.config import env

ALGORITMO = "HS256"
ROLES = ("teacher_recruiter", "validator", "admin")
# Los relojes de quien emite el token y de quien lo valida pueden diferir unos segundos (por ejemplo, al sincronizarse
# el reloj de WSL): sin tolerancia, un token recién emitido podía rechazarse por tener su `iat` "en el futuro".
TOLERANCIA_RELOJ_SEGUNDOS = 10

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    email: str
    name: str | None
    roles: tuple[str, ...]


def create_access_token(user_id: UUID, email: str, name: str | None, roles: list[str]) -> str:
    """Firma un JWT con los claims `sub` (id del usuario), `email`, `name`, `roles`, `iat` y `exp`."""
    ahora = int(time.time())
    claims = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "roles": roles,
        "iat": ahora,
        "exp": ahora + int(env("JWT_TTL_SECONDS", "3600")),
    }
    return jwt.encode(claims, env("JWT_SECRET"), algorithm=ALGORITMO)


def decode_token(token: str) -> AuthUser:
    """Valida firma y expiración (con `TOLERANCIA_RELOJ_SEGUNDOS` de margen) y devuelve el usuario del token.
    Lanza 401 si no es válido."""
    try:
        claims = jwt.decode(token, env("JWT_SECRET"), algorithms=[ALGORITMO], leeway=TOLERANCIA_RELOJ_SEGUNDOS)
        return AuthUser(
            id=UUID(claims["sub"]),
            email=claims["email"],
            name=claims.get("name"),
            roles=tuple(claims.get("roles", [])),
        )
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido o vencido")


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> AuthUser:
    """Dependencia: exige el encabezado `Authorization: Bearer <jwt>` y devuelve el usuario."""
    if creds is None:
        raise HTTPException(status_code=401, detail="Falta el token")
    return decode_token(creds.credentials)


def require_roles(*roles: str):
    """Dependencia: el usuario debe tener al menos uno de `roles`; si no, 403 (cuenta no autorizada)."""

    def _check(user: AuthUser = Depends(current_user)) -> AuthUser:
        if not set(roles) & set(user.roles):
            raise HTTPException(status_code=403, detail="Tu cuenta no está autorizada para esta acción")
        return user

    return _check
