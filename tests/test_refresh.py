"""Sesión con refresh token: renovación, rotación, vencimiento, cierre de sesión y roles al renovar."""
import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from identity import service
from shared.config import env
from shared.db import connect
from shared.errors import Unauthorized
from shared.security import decode_token

from tests.conftest import TEST_DOMAIN


@pytest.fixture(scope="module")
def identity():
    from identity.main import app
    return TestClient(app, follow_redirects=False)


def _login(roles=()):
    """Login simulado (como el callback de Google). Devuelve (email, access, refresh)."""
    suf = uuid.uuid4().hex[:10]
    perfil = {"sub": f"g-{suf}", "email": f"r{suf}{TEST_DOMAIN}", "email_verified": True, "name": "Prueba"}
    with connect() as conn, conn.cursor() as cur:
        for rol in roles:
            service.grant_role(cur, perfil["email"], rol)
        _, access, refresh = service.login_with_google(cur, perfil)
    return perfil["email"], access, refresh


def test_el_login_entrega_access_y_refresh_y_guarda_solo_el_hash():
    email, access, refresh = _login(["validator"])
    assert decode_token(access).roles == ("validator",) and len(refresh) >= 40
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT token_hash, expires_at, revoked_at FROM identity.refresh_tokens t "
                    "JOIN identity.users u ON u.id = t.user_id WHERE u.email = %s", (email,))
        fila = cur.fetchone()
    assert fila["token_hash"] != refresh and refresh not in fila["token_hash"] and fila["revoked_at"] is None


def test_refrescar_entrega_tokens_nuevos_y_los_roles_vigentes():
    email, access, refresh = _login(["validator"])
    with connect() as conn, conn.cursor() as cur:
        service.grant_role(cur, email, "teacher_recruiter")  # se asigna DESPUÉS del login
    with connect() as conn, conn.cursor() as cur:
        nuevo_access, nuevo_refresh = service.refresh_session(cur, refresh)
    assert nuevo_refresh != refresh and nuevo_access != access
    assert sorted(decode_token(nuevo_access).roles) == ["teacher_recruiter", "validator"]


def test_el_refresh_token_sirve_una_sola_vez():
    _, _, refresh = _login()
    with connect() as conn, conn.cursor() as cur:
        service.refresh_session(cur, refresh)
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, refresh)


def test_un_refresh_token_vencido_se_rechaza():
    email, _, refresh = _login()
    with connect() as conn, conn.cursor() as cur:
        cur.execute("UPDATE identity.refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = "
                    "(SELECT id FROM identity.users WHERE email = %s)", (email,))
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, refresh)


def test_un_token_desconocido_se_rechaza():
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, "no-existe")


def test_cerrar_sesion_revoca_el_refresh_token():
    _, _, refresh = _login()
    with connect() as conn, conn.cursor() as cur:
        service.logout(cur, refresh)
        service.logout(cur, "desconocido")  # cerrar una sesión inexistente no falla
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, refresh)


def test_endpoints_refresh_y_logout(identity):
    _, _, refresh = _login(["validator"])
    r = identity.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200 and decode_token(r.json()["access_token"]).roles == ("validator",)
    assert identity.post("/auth/refresh", json={"refresh_token": refresh}).status_code == 401  # ya usado
    assert identity.post("/auth/logout", json={"refresh_token": r.json()["refresh_token"]}).status_code == 204
    assert identity.post("/auth/refresh", json={"refresh_token": r.json()["refresh_token"]}).status_code == 401
    assert identity.post("/auth/refresh", json={}).status_code == 422


def test_con_el_access_token_vencido_se_renueva_y_se_sigue_usando_la_api(identity, catalog_client):
    email, access, refresh = _login(["teacher_recruiter"])
    claims = jwt.decode(access, env("JWT_SECRET"), algorithms=["HS256"])
    vencido = jwt.encode({**claims, "iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600},
                         env("JWT_SECRET"), algorithm="HS256")
    assert catalog_client.get("/skills", headers={"Authorization": f"Bearer {vencido}"}).status_code == 401
    nuevo = identity.post("/auth/refresh", json={"refresh_token": refresh}).json()["access_token"]
    assert catalog_client.get("/skills", headers={"Authorization": f"Bearer {nuevo}"}).status_code == 200
