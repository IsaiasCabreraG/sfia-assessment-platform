"""Fixtures de las pruebas. Usan la BD real configurada en `.env` (se limpian al terminar)
y no llaman a la IA: `ask_llm` se reemplaza por una respuesta controlada."""
import uuid

import pytest
from fastapi.testclient import TestClient

from shared.db import connect
from shared.security import create_access_token

TEST_DOMAIN = "@test.sprint1.local"


def _cleanup() -> None:
    """Borra todo lo creado por usuarios de prueba (en orden de dependencias)."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("CREATE TEMP TABLE tu AS SELECT id FROM identity.users WHERE email LIKE %s", (f"%{TEST_DOMAIN}",))
        cur.execute("CREATE TEMP TABLE ti AS SELECT id FROM content.items WHERE created_by IN (SELECT id FROM tu)")
        cur.execute("CREATE TEMP TABLE tv AS SELECT id FROM content.item_versions WHERE item_id IN (SELECT id FROM ti)")
        for sql in (
            "DELETE FROM content.rubric_levels WHERE criterion_id IN "
            "(SELECT id FROM content.rubric_criteria WHERE item_version_id IN (SELECT id FROM tv))",
            "DELETE FROM content.rubric_criteria WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_findings WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_choice_options WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_true_false WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_open_question WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_coding WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_system_design WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_debugging WHERE item_version_id IN (SELECT id FROM tv)",
            "DELETE FROM content.item_scores WHERE item_version_id IN (SELECT id FROM tv) "
            "OR validator_id IN (SELECT id FROM tu)",
            "DELETE FROM content.item_versions WHERE id IN (SELECT id FROM tv)",
            "DELETE FROM content.items WHERE id IN (SELECT id FROM ti)",
            "DELETE FROM content.generation_requests WHERE requested_by IN (SELECT id FROM tu)",
            "DELETE FROM events.events WHERE aggregate_id IN (SELECT id FROM tu) OR aggregate_id IN (SELECT id FROM ti)",
            "DELETE FROM identity.refresh_tokens WHERE user_id IN (SELECT id FROM tu)",
            "DELETE FROM identity.user_roles WHERE user_id IN (SELECT id FROM tu)",
            "DELETE FROM identity.users WHERE id IN (SELECT id FROM tu)",
        ):
            cur.execute(sql)


@pytest.fixture(scope="session", autouse=True)
def limpiar_bd():
    _cleanup()
    yield
    _cleanup()


def make_user(roles: list[str]) -> dict:
    """Crea un usuario de prueba con esos roles y devuelve {id, email, headers}."""
    email = f"u{uuid.uuid4().hex[:10]}{TEST_DOMAIN}"
    with connect() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO identity.users (email, name, google_id) VALUES (%s, %s, %s) RETURNING id",
                    (email, "Usuario de prueba", f"test-{email}"))
        user_id = cur.fetchone()["id"]
        for role in roles:
            cur.execute("INSERT INTO identity.user_roles (user_id, role) VALUES (%s, %s)", (user_id, role))
    token = create_access_token(user_id, email, "Usuario de prueba", roles)
    return {"id": user_id, "email": email, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def docente():
    return make_user(["teacher_recruiter"])


@pytest.fixture
def validador():
    return make_user(["validator"])


@pytest.fixture
def sin_rol():
    return make_user([])


@pytest.fixture(scope="session")
def content_client():
    from content.main import app
    return TestClient(app)


@pytest.fixture(scope="session")
def catalog_client():
    from catalog.main import app
    return TestClient(app)


@pytest.fixture(scope="session")
def llm_client():
    from llm.main import app
    return TestClient(app)


@pytest.fixture(scope="session")
def skill_ids():
    """Dos skills del catálogo cargado."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, code FROM catalog.skills ORDER BY code LIMIT 2")
        return cur.fetchall()


@pytest.fixture
def fake_llm(monkeypatch):
    """Reemplaza la llamada a la IA. `fake_llm.respuestas` es la lista de respuestas, una por llamada: un texto,
    una excepción o un `llm_answer(...)` (respuesta válida que se adapta al prompt recibido). El paso de las
    respuestas de referencia de los tipos abiertos lo contesta solo, sin gastar una respuesta de la lista."""
    from tests.samples import RespuestaIA, es_prompt_de_referencia, respuesta_desde_prompt

    class Fake:
        respuestas: list = []
        prompts: list = []

    def _ask(prompt, authorization):
        Fake.prompts.append(prompt)
        if es_prompt_de_referencia(prompt):
            return respuesta_desde_prompt(prompt)
        r = Fake.respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        if isinstance(r, RespuestaIA):
            return respuesta_desde_prompt(prompt, r.item_type, r.count, r.bloque)
        return r

    Fake.respuestas, Fake.prompts = [], []
    monkeypatch.setattr("content.service.ask_llm", _ask)
    return Fake
