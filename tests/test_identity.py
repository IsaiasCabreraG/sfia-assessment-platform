"""HU-01: login con Google y lista blanca por rol (user_roles)."""
import uuid

import jwt
import pytest
from fastapi import HTTPException

from identity import service
from shared.config import env
from shared.db import connect
from shared.errors import BadRequest
from shared.security import decode_token, require_roles

from tests.conftest import TEST_DOMAIN


def _profile(email=None, verified=True):
    suffix = uuid.uuid4().hex[:10]
    return {"sub": f"g-{suffix}", "email": email or f"g{suffix}{TEST_DOMAIN}", "email_verified": verified,
            "name": "Persona Prueba", "picture": "http://x/y.png"}


def test_primer_login_crea_usuario_sin_roles_y_emite_jwt():
    with connect() as conn, conn.cursor() as cur:
        user, token, _ = service.login_with_google(cur, _profile())
    claims = jwt.decode(token, env("JWT_SECRET"), algorithms=["HS256"])
    assert claims["sub"] == str(user["id"]) and claims["roles"] == []


def test_segundo_login_no_duplica_usuario():
    p = _profile()
    with connect() as conn, conn.cursor() as cur:
        u1, _, _ = service.login_with_google(cur, p)
        u2, _, _ = service.login_with_google(cur, p)
    assert u1["id"] == u2["id"]


def test_correo_no_verificado_se_rechaza():
    with connect() as conn, conn.cursor() as cur, pytest.raises(BadRequest):
        service.login_with_google(cur, _profile(verified=False))


def test_rol_asignado_antes_del_primer_login_queda_en_el_token():
    p = _profile()
    with connect() as conn, conn.cursor() as cur:
        service.grant_role(cur, p["email"], "validator")
        service.grant_role(cur, p["email"], "teacher_recruiter")
        user, token, _ = service.login_with_google(cur, p)
        assert user["google_id"] == p["sub"]  # el usuario provisional se completó con el google_id real
    assert sorted(decode_token(token).roles) == ["teacher_recruiter", "validator"]


def test_rol_invalido_y_quitar_rol():
    p = _profile()
    with connect() as conn, conn.cursor() as cur:
        with pytest.raises(BadRequest):
            service.grant_role(cur, p["email"], "superuser")
        service.grant_role(cur, p["email"], "validator")
        service.revoke_role(cur, p["email"], "validator")
        _, token, _ = service.login_with_google(cur, p)
    assert decode_token(token).roles == ()


def test_token_invalido_o_sin_rol_es_rechazado(catalog_client, sin_rol):
    assert catalog_client.get("/skills").status_code == 401
    assert catalog_client.get("/skills", headers={"Authorization": "Bearer basura"}).status_code == 401
    assert catalog_client.get("/skills", headers=sin_rol["headers"]).status_code == 403


def test_require_roles_acepta_y_rechaza():
    from shared.security import AuthUser
    user = AuthUser(id=uuid.uuid4(), email="a@b", name=None, roles=("validator",))
    assert require_roles("validator")(user) is user
    with pytest.raises(HTTPException) as e:
        require_roles("teacher_recruiter")(user)
    assert e.value.status_code == 403
