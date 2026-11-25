"""Un test por cada criterio de aceptación de las 16 historias del Sprint 1 (docs/thesis/user-stories.md).

Cada test se llama `test_huNN_cK_...` y su docstring cita el criterio textual. Las pruebas de
`test_identity.py`, `test_catalog.py` y `test_content.py` cubren además los casos límite.
La IA se reemplaza por respuestas controladas (fixture `fake_llm`).
Los criterios que solo existen en pantalla (botones, avisos, bloqueo) los cubre `tests/e2e/` y se indican como "E2E".
"""
import socket
import urllib.parse
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from content.types import ITEM_TYPES, OPEN_TYPES
from shared.config import env
from shared.db import connect
from tests.conftest import make_user
from tests.helpers import borradores, generar, publicar
from tests.samples import llm_answer

TIPOS = list(ITEM_TYPES)


# ---------- ayudas ----------

def crear_item(client, docente, fake_llm, skill_id, item_type="true_false", **kw) -> str:
    fake_llm.respuestas = [llm_answer(item_type, 1)]
    r = generar(client, docente, skill_id, item_type, **kw)
    assert r.status_code == 201, r.text
    return r.json()["items"][0]["id"]


def detalle(client, user, item_id) -> dict:
    r = client.get(f"/items/{item_id}", headers=user["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def ids_listados(client, user, **params) -> set:
    params.setdefault("limit", 200)
    r = client.get("/items", params=params, headers=user["headers"])
    assert r.status_code == 200, r.text
    return {i["id"] for i in r.json()["items"]}


# ---------- HU-01 Iniciar sesión con Google ----------

def _hay_red() -> bool:
    try:
        socket.create_connection(("accounts.google.com", 443), timeout=3).close()
        return True
    except OSError:
        return False


@pytest.fixture
def identity_client():
    from identity.main import app
    return TestClient(app, follow_redirects=False)


@pytest.mark.skipif(not _hay_red(), reason="requiere red para leer la configuración OIDC de Google")
def test_hu01_c1_existe_la_opcion_de_iniciar_sesion_con_google(identity_client):
    """Existe la opción de iniciar sesión con Google (OIDC)."""
    for portal in ("docente", "validador"):
        r = identity_client.get("/auth/login", params={"portal": portal})
        assert r.status_code in (302, 307)
        destino = urllib.parse.urlparse(r.headers["location"])
        assert destino.netloc == "accounts.google.com"
        q = urllib.parse.parse_qs(destino.query)
        assert "openid" in q["scope"][0] and q["client_id"][0] == env("GOOGLE_CLIENT_ID")


def test_hu01_c2_tras_autenticarme_accedo_a_la_plataforma_con_mi_cuenta(identity_client, monkeypatch):
    """Tras autenticarme con Google, accedo a la plataforma con mi cuenta."""
    import identity.routes as rutas

    sufijo = uuid.uuid4().hex[:10]
    email = f"hu01{sufijo}@test.sprint1.local"

    async def google_responde(request):  # Google ya validó la cuenta: devuelve su perfil
        return {"userinfo": {"sub": f"g-{sufijo}", "email": email, "email_verified": True, "name": "Ana Prueba"}}

    monkeypatch.setattr(rutas.oauth.google, "authorize_access_token", google_responde)
    r = identity_client.get("/auth/callback")
    assert r.status_code in (302, 307)
    destino = urllib.parse.urlparse(r.headers["location"])
    assert r.headers["location"].startswith(env("PORTAL_DOCENTE_URL"))
    fragmento = urllib.parse.parse_qs(destino.fragment)
    token = fragmento["access_token"][0]
    assert fragmento["refresh_token"][0]  # el login entrega también el refresh token
    me = identity_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == email and me.json()["name"] == "Ana Prueba"


def _sesion_nueva(roles=()):
    """Login simulado. Devuelve (email, access, refresh)."""
    from identity import service
    suf = uuid.uuid4().hex[:10]
    perfil = {"sub": f"g-{suf}", "email": f"hu01{suf}@test.sprint1.local", "email_verified": True, "name": "Ana"}
    with connect() as conn, conn.cursor() as cur:
        for rol in roles:
            service.grant_role(cur, perfil["email"], rol)
        _, access, refresh = service.login_with_google(cur, perfil)
    return perfil["email"], access, refresh


def test_hu01_c3_la_sesion_se_renueva_sola_mientras_la_uso():
    """Mientras uso la plataforma, mi sesión se renueva sola; si paso 7 días sin usarla, debo iniciar sesión de nuevo."""
    from identity import service
    from shared.errors import Unauthorized
    from shared.security import decode_token
    email, access, refresh = _sesion_nueva(["validator"])
    with connect() as conn, conn.cursor() as cur:
        nuevo_access, nuevo_refresh = service.refresh_session(cur, refresh)  # el portal lo hace al recibir un 401
        assert decode_token(nuevo_access).roles == ("validator",)
        # cada renovación entrega un refresh token con otros 7 días de vida
        cur.execute("SELECT expires_at - now() AS resta FROM identity.refresh_tokens WHERE revoked_at IS NULL "
                    "AND user_id = (SELECT id FROM identity.users WHERE email = %s)", (email,))
        assert 6 * 86400 < cur.fetchone()["resta"].total_seconds() <= 7 * 86400 + 60  # margen: reloj de Python vs. now() de la BD
        # pasados 7 días sin usarla, ya no se puede renovar
        cur.execute("UPDATE identity.refresh_tokens SET expires_at = now() - interval '1 second' WHERE revoked_at IS NULL "
                    "AND user_id = (SELECT id FROM identity.users WHERE email = %s)", (email,))
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, nuevo_refresh)


def test_hu01_c4_al_cerrar_sesion_ya_no_se_puede_renovar():
    """Al cerrar sesión, mi sesión deja de poder renovarse."""
    from identity import service
    from shared.errors import Unauthorized
    _, _, refresh = _sesion_nueva()
    with connect() as conn, conn.cursor() as cur:
        service.logout(cur, refresh)
    with connect() as conn, conn.cursor() as cur, pytest.raises(Unauthorized):
        service.refresh_session(cur, refresh)


# ---------- HU-02 Acceder al catálogo SFIA ----------

# c1 "Hay un botón que lleva al sitio oficial de SFIA": E2E (tests/e2e/generar.mjs).

def test_hu02_c2_al_generar_puedo_elegir_skill_nivel_y_perfil_de_rol(catalog_client, docente):
    """Al generar ítems puedo elegir una skill del catálogo, su nivel de responsabilidad (1 a 7) y partir de un
    perfil de rol predefinido que carga las skills del rol."""
    h = docente["headers"]
    assert len(catalog_client.get("/skills", headers=h).json()) >= 100
    assert [n["level"] for n in catalog_client.get("/levels", headers=h).json()] == [1, 2, 3, 4, 5, 6, 7]
    perfiles = catalog_client.get("/role-profiles", headers=h).json()
    assert len(perfiles) >= 50
    detalle = catalog_client.get(f"/role-profiles/{perfiles[0]['id']}", headers=h).json()
    assert detalle["skills"] and {"id", "code", "min_level", "is_primary"} <= detalle["skills"][0].keys()


def test_hu02_c3_cada_skill_conserva_su_nivel_minimo_y_maximo(catalog_client, docente):
    """Cada skill conserva el nivel mínimo y máximo en que SFIA la define."""
    skills = catalog_client.get("/skills", headers=docente["headers"]).json()
    assert all(1 <= s["min_level"] <= s["max_level"] <= 7 for s in skills)
    with connect() as conn, conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
        cur.execute("UPDATE catalog.skills SET min_level = 5, max_level = 2 WHERE code = (SELECT min(code) FROM catalog.skills)")


# ---------- HU-03 Asociar ítems a una skill y un nivel SFIA ----------

def test_hu03_c1_todo_item_tiene_una_unica_skill_y_un_nivel(content_client, docente, skill_ids, fake_llm):
    """Todo ítem del banco está asociado a una única skill SFIA y a un nivel de responsabilidad."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"], level=5)
    d = detalle(content_client, docente, item_id)
    assert d["skill"]["id"] == str(skill_ids[0]["id"]) and d["level"] == 5
    with connect() as conn, conn.cursor() as cur:
        # Una única skill: es una columna de `items`, no una relación de varios a varios.
        cur.execute("SELECT count(*) AS n FROM content.items WHERE id = %s AND skill_id IS NOT NULL", (item_id,))
        assert cur.fetchone()["n"] == 1
        # Sin skill o sin nivel, la base de datos rechaza el ítem o su versión.
        with pytest.raises(psycopg.errors.NotNullViolation):
            cur.execute("INSERT INTO content.items (status, created_by) VALUES ('active', %s)", (docente["id"],))
    with connect() as conn, conn.cursor() as cur, pytest.raises(psycopg.errors.NotNullViolation):
        cur.execute("INSERT INTO content.item_versions (item_id, type, version, origin, estimated_minutes, "
                    "evaluation_goal, statement) VALUES (%s, 'true_false', 99, 'generated', 5, 'g', 's')", (item_id,))


def test_hu03_c2_la_skill_y_el_nivel_son_visibles_al_consultar_el_item(content_client, docente, validador,
                                                                       skill_ids, fake_llm):
    """La skill y el nivel de un ítem son visibles al consultarlo."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"], level=6)
    for user in (docente, validador):
        d = detalle(content_client, user, item_id)
        assert d["skill"]["code"] == skill_ids[0]["code"] and d["level"] == 6
    fila = next(i for i in content_client.get("/items", params={"limit": 200}, headers=validador["headers"]).json()["items"]
                if i["id"] == item_id)
    assert fila["skill_code"] == skill_ids[0]["code"] and fila["level"] == 6


# ---------- HU-04 Generar borradores con IA ----------

@pytest.mark.parametrize("item_type", TIPOS)
def test_hu04_c1_la_ia_genera_borradores_de_preguntas_ejercicios_y_rubricas(content_client, docente, validador,
                                                                           skill_ids, fake_llm, item_type):
    """La IA genera borradores de preguntas, de ejercicios y de rúbricas."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"], item_type)
    d = detalle(content_client, validador, item_id)
    assert d["type"] == item_type and d["origin"] == "generated" and d["statement"]
    if item_type in OPEN_TYPES:  # las rúbricas se generan junto con los tipos abiertos
        assert d["rubric"] and sum(c["weight"] for c in d["rubric"]) == 100
    else:
        assert d["rubric"] is None
    # Preguntas: single_choice, true_false y open_question. Ejercicios: coding, system_design y debugging.
    assert item_type in {"single_choice", "true_false", "open_question", "coding", "system_design", "debugging"}


def test_hu04_c2_los_borradores_generados_quedan_sin_puntuar(content_client, docente, skill_ids, fake_llm):
    """Los borradores generados quedan sin puntuar."""
    fake_llm.respuestas = [llm_answer("single_choice", 3)]
    r = generar(content_client, docente, skill_ids[0]["id"], "single_choice", count=3)
    for item in r.json()["items"]:
        assert detalle(content_client, docente, item["id"])["score"] == {"average": None, "count": 0}
        with connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM content.item_scores WHERE item_version_id = %s", (item["version_id"],))
            assert cur.fetchone()["n"] == 0


# ---------- HU-05 Puntuar ítems generados por IA ----------

@pytest.mark.parametrize("valor", [1, 2, 3, 4, 5])
def test_hu05_c1_puedo_asignar_una_puntuacion_de_1_a_5_estrellas_enteras(content_client, docente, validador,
                                                                         skill_ids, fake_llm, valor):
    """Puedo asignar a un ítem una puntuación de 1 a 5 estrellas enteras."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    r = content_client.put(f"/items/{item_id}/score", json={"score": valor}, headers=validador["headers"])
    assert r.status_code == 200 and float(r.json()["my_score"]) == valor


@pytest.mark.parametrize("valor", [0, 6, -1, 10, 4.5, 2.55])
def test_hu05_c1_no_acepta_puntuaciones_fuera_de_rango_ni_medias_estrellas(content_client, docente, validador,
                                                                          skill_ids, fake_llm, valor):
    """Puedo asignar de 1 a 5 estrellas enteras (límites); no hay medias estrellas."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    r = content_client.put(f"/items/{item_id}/score", json={"score": valor}, headers=validador["headers"])
    assert r.status_code == 400
    assert detalle(content_client, validador, item_id)["score"]["count"] == 0


def test_hu05_c2_los_extremos_y_el_punto_medio_de_la_escala_se_conservan(content_client, docente, skill_ids, fake_llm):
    """1 estrella representa un ítem malo, 3 uno de calidad media y 5 uno bueno."""
    for etiqueta, valor in (("malo", 1), ("medio", 3), ("bueno", 5)):
        validador = make_user(["validator"])
        item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
        content_client.put(f"/items/{item_id}/score", json={"score": valor}, headers=validador["headers"])
        d = detalle(content_client, validador, item_id)
        assert float(d["my_score"]) == valor and float(d["score"]["average"]) == valor, etiqueta


def test_hu05_c3_la_puntuacion_asignada_queda_guardada_en_el_item(content_client, docente, validador, skill_ids,
                                                                  fake_llm):
    """La puntuación asignada queda guardada en el ítem."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.put(f"/items/{item_id}/score", json={"score": 4}, headers=validador["headers"])
    assert detalle(content_client, validador, item_id)["my_score"] == 4
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT s.score FROM content.item_scores s JOIN content.item_versions v ON v.id = s.item_version_id "
                    "WHERE v.item_id = %s AND s.validator_id = %s", (item_id, validador["id"]))
        assert cur.fetchone()["score"] == 4


def test_hu05_c4_un_mismo_item_puede_ser_puntuado_por_distintos_validadores(content_client, docente, validador,
                                                                           skill_ids, fake_llm):
    """Un mismo ítem puede ser puntuado por distintos validadores."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    otro = make_user(["validator"])
    content_client.put(f"/items/{item_id}/score", json={"score": 1}, headers=validador["headers"])
    content_client.put(f"/items/{item_id}/score", json={"score": 5}, headers=otro["headers"])
    d = detalle(content_client, docente, item_id)
    assert d["score"]["count"] == 2 and float(d["score"]["average"]) == 3.0
    assert float(detalle(content_client, validador, item_id)["my_score"]) == 1.0
    assert float(detalle(content_client, otro, item_id)["my_score"]) == 5.0


def test_hu05_c5_un_item_sin_puntuar_es_distinto_de_uno_puntuado_con_1_estrella(content_client, docente, validador,
                                                                               skill_ids, fake_llm):
    """Un ítem sin puntuar es distinto de un ítem puntuado con 1 estrella."""
    sin = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    con_una = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.put(f"/items/{con_una}/score", json={"score": 1}, headers=validador["headers"])
    assert detalle(content_client, docente, sin)["score"] == {"average": None, "count": 0}
    d = detalle(content_client, docente, con_una)
    assert d["score"]["count"] == 1 and float(d["score"]["average"]) == 1.0


# ---------- HU-06 Crear ítems de una o varias skills ----------

def test_hu06_c1_puedo_elegir_una_skill_o_varias_en_una_misma_solicitud(content_client, docente, skill_ids, fake_llm):
    """Puedo elegir una skill, o añadir varias en una misma solicitud o partir de un rol SFIA."""
    fake_llm.respuestas = [llm_answer("true_false", 1), llm_answer("true_false", 1)]
    grupos = []
    for skill in skill_ids:  # una solicitud con dos skills: un pedido a la IA por skill
        d = borradores(content_client, docente, skill["id"], "true_false").json()
        grupos.append({"skill_id": str(skill["id"]), "level": 3, "item_type": "true_false", "estimated_minutes": 10,
                       "context": None, "items": d["drafts"]})
    r = content_client.post("/items/publish", json={"available_to_experts": True, "groups": grupos}, headers=docente["headers"])
    assert r.status_code == 201 and len(r.json()["items"]) == 2
    codigos = {detalle(content_client, docente, i["id"])["skill"]["code"] for i in r.json()["items"]}
    assert codigos == {s["code"] for s in skill_ids}
    assert generar(content_client, docente, "00000000-0000-0000-0000-000000000000").status_code == 404
    # "partir de un rol" (precargar las skills de un perfil) ocurre en pantalla: E2E.


def test_hu06_c2_indico_nivel_y_por_tipo_la_cantidad_y_el_tiempo_de_cada_item(content_client, docente, skill_ids, fake_llm):
    """Para cada skill indico el nivel de responsabilidad y, por cada tipo de ítem, la cantidad y el tiempo estimado de cada ítem."""
    sid = skill_ids[0]["id"]
    fake_llm.respuestas = [llm_answer("single_choice", 2), llm_answer("coding", 1)]
    alt = borradores(content_client, docente, sid, "single_choice", count=2, level=4, minutes=5).json()
    cod = borradores(content_client, docente, sid, "coding", count=1, level=4, minutes=45).json()
    assert "Genera 2" in fake_llm.prompts[0] and "5 minutos" in fake_llm.prompts[0] and "Nivel de responsabilidad: 4" in fake_llm.prompts[0]
    assert "Genera 1" in fake_llm.prompts[1] and "45 minutos" in fake_llm.prompts[1]
    grupos = [{"skill_id": str(sid), "level": 4, "item_type": t, "estimated_minutes": m, "context": None, "items": d["drafts"]}
              for t, m, d in (("single_choice", 5, alt), ("coding", 45, cod))]
    r = content_client.post("/items/publish", json={"available_to_experts": True, "groups": grupos}, headers=docente["headers"])
    minutos = sorted((detalle(content_client, docente, i["id"])["type"], detalle(content_client, docente, i["id"])["estimated_minutes"])
                     for i in r.json()["items"])
    assert minutos == [("coding", 45), ("single_choice", 5), ("single_choice", 5)]  # cada tipo con su tiempo
    base = {"skill_id": str(sid), "item_type": "true_false"}
    for incompleto in ({}, {"level": 3}, {"level": 3, "item_count": 2}):  # nivel, cantidad y tiempo son obligatorios
        assert content_client.post("/drafts", json={**base, **incompleto}, headers=docente["headers"]).status_code == 422


@pytest.mark.parametrize("cantidad", [1, 3, 10])
def test_hu06_c3_se_generan_borradores_de_acuerdo_con_lo_indicado(content_client, docente, skill_ids, fake_llm, cantidad):
    """Se generan borradores de acuerdo con lo indicado."""
    fake_llm.respuestas = [llm_answer("single_choice", cantidad)]
    r = borradores(content_client, docente, skill_ids[1]["id"], "single_choice", count=cantidad, level=4, minutes=12)
    d = r.json()
    assert (d["level"], d["item_type"], d["estimated_minutes"], len(d["drafts"])) == (4, "single_choice", 12, cantidad)
    assert d["skill_id"] == str(skill_ids[1]["id"])


# ---------- HU-07 Filtrar ítems por revisar ----------

def test_hu07_c1_solo_se_listan_los_items_activos_y_disponibles_para_expertos(content_client, docente, validador, skill_ids, fake_llm):
    """Solo se listan los ítems activos y disponibles para expertos."""
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    privado = generar(content_client, docente, skill_ids[0]["id"], "true_false", disponible=False).json()["items"][0]["id"]
    assert privado not in ids_listados(content_client, validador)
    activo = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    inactivo = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.patch(f"/items/{inactivo}/status", json={"status": "inactive"}, headers=docente["headers"])
    assert activo in ids_listados(content_client, validador) and inactivo not in ids_listados(content_client, validador)
    # El validador no puede pedir los inactivos ni cambiando el parámetro.
    assert inactivo not in ids_listados(content_client, validador, status="inactive")
    assert inactivo not in ids_listados(content_client, validador, status="")


def test_hu07_c2_puedo_filtrar_por_skill(content_client, docente, validador, skill_ids, fake_llm):
    """Puedo filtrar por skill."""
    a = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    b = crear_item(content_client, docente, fake_llm, skill_ids[1]["id"])
    filtrado = ids_listados(content_client, validador, skill_id=str(skill_ids[0]["id"]))
    assert a in filtrado and b not in filtrado


def test_hu07_c3_puedo_filtrar_por_rol(content_client, docente, validador, fake_llm):
    """Puedo filtrar por rol (a través de las skills del perfil de rol)."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""SELECT p.id AS profile_id,
                              (SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = p.id LIMIT 1) AS dentro,
                              (SELECT s.id FROM catalog.skills s WHERE s.id NOT IN
                                 (SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = p.id) LIMIT 1) AS fuera
                       FROM catalog.role_profiles p ORDER BY p.name LIMIT 1""")
        r = cur.fetchone()
    del_rol = crear_item(content_client, docente, fake_llm, r["dentro"])
    fuera_del_rol = crear_item(content_client, docente, fake_llm, r["fuera"])
    filtrado = ids_listados(content_client, validador, role_profile_id=str(r["profile_id"]))
    assert del_rol in filtrado and fuera_del_rol not in filtrado


def test_hu07_c4_puedo_filtrar_por_puntuacion(content_client, docente, validador, skill_ids, fake_llm):
    """Puedo filtrar por puntuación."""
    bajo = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    alto = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.put(f"/items/{bajo}/score", json={"score": 1}, headers=validador["headers"])
    content_client.put(f"/items/{alto}/score", json={"score": 4}, headers=validador["headers"])
    assert alto in ids_listados(content_client, validador, min_score=4) and bajo not in ids_listados(content_client, validador, min_score=4)
    assert bajo in ids_listados(content_client, validador, max_score=2) and alto not in ids_listados(content_client, validador, max_score=2)
    rango = ids_listados(content_client, validador, min_score=1, max_score=5)
    assert {bajo, alto} <= rango


def test_hu07_c5_distingo_los_items_sin_puntuar_de_los_de_1_estrella(content_client, docente, validador,
                                                                    skill_ids, fake_llm):
    """Puedo distinguir los ítems sin puntuar de los que tienen 1 estrella."""
    sin = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    una = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.put(f"/items/{una}/score", json={"score": 1}, headers=validador["headers"])
    sin_puntuar = ids_listados(content_client, validador, scored="unscored")
    puntuados = ids_listados(content_client, validador, scored="scored")
    assert sin in sin_puntuar and una not in sin_puntuar
    assert una in puntuados and sin not in puntuados
    assert una in ids_listados(content_client, validador, min_score=1, max_score=1)
    assert sin not in ids_listados(content_client, validador, min_score=1, max_score=1)
    filas = {i["id"]: i for i in content_client.get("/items", params={"limit": 200}, headers=validador["headers"]).json()["items"]}
    assert filas[sin]["average_score"] is None and filas[una]["average_score"] == 1.0


# ---------- HU-08 Ver los atributos de un ítem ----------

@pytest.mark.parametrize("item_type", TIPOS)
def test_hu08_c1_a_c5_veo_skill_rubrica_tiempo_respuesta_correcta_y_enunciado(content_client, docente, validador,
                                                                              skill_ids, fake_llm, item_type):
    """Veo la skill, su rúbrica, el tiempo estimado, la respuesta correcta y el enunciado."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"], item_type, minutes=17)
    d = detalle(content_client, validador, item_id)
    assert d["skill"]["code"] == skill_ids[0]["code"]                      # C1: la skill
    assert (d["rubric"] is not None) == (item_type in OPEN_TYPES)           # C2: la rúbrica (tipos abiertos)
    assert d["estimated_minutes"] == 17                                     # C3: el tiempo estimado
    assert d["statement"]                                                   # C5: el enunciado
    c = d["content"]                                                        # C4: la respuesta correcta
    respuesta = {
        "single_choice": lambda: any(o["is_correct"] for o in c["options"]),
        "true_false": lambda: c["correct_answer"] in (True, False),
        "open_question": lambda: c["reference_answer"],
        "coding": lambda: c["reference_solution"],
        "system_design": lambda: c["reference_answer"],
        "debugging": lambda: c["reference_answer"] and c["findings"],
    }[item_type]
    assert respuesta()


# ---------- HU-09 Gestionar el estado de un ítem ----------

def test_hu09_c1_un_item_esta_activo_o_inactivo(content_client, docente, skill_ids, fake_llm):
    """Un ítem está activo o inactivo."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    assert detalle(content_client, docente, item_id)["status"] == "active"
    for estado in ("inactive", "active"):
        assert content_client.patch(f"/items/{item_id}/status", json={"status": estado},
                                    headers=docente["headers"]).status_code == 200
        assert detalle(content_client, docente, item_id)["status"] == estado
    assert content_client.patch(f"/items/{item_id}/status", json={"status": "borrador"},
                                headers=docente["headers"]).status_code == 400
    with connect() as conn, conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
        cur.execute("UPDATE content.items SET status = 'borrador' WHERE id = %s", (item_id,))


def test_hu09_c2_un_item_activo_se_muestra_y_se_usa_sin_validacion_de_un_experto(content_client, docente, validador,
                                                                                 skill_ids, fake_llm):
    """Un ítem activo se puede mostrar y usar, sin requerir validación de un experto."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])   # recién generado, sin puntuar
    assert detalle(content_client, docente, item_id)["score"]["count"] == 0
    assert item_id in ids_listados(content_client, docente) and item_id in ids_listados(content_client, validador)
    content_client.patch(f"/items/{item_id}/status", json={"status": "inactive"}, headers=docente["headers"])
    assert item_id not in ids_listados(content_client, validador)                  # inactivo: ya no se muestra
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 404


# ---------- HU-10 Contar con distintos tipos de ítem ----------

def test_hu10_c1_el_banco_soporta_los_seis_tipos(content_client, docente, skill_ids, fake_llm):
    """El banco soporta los seis tipos de ítem."""
    tipos = {t["type"] for t in content_client.get("/item-types", headers=docente["headers"]).json()}
    assert tipos == {"single_choice", "true_false", "open_question", "coding", "system_design", "debugging"}
    for t in TIPOS:  # y cada uno se puede crear y guardar
        crear_item(content_client, docente, fake_llm, skill_ids[0]["id"], t)


def test_hu10_c2_cada_version_pertenece_a_uno_de_esos_tipos(content_client, docente, skill_ids, fake_llm):
    """Cada versión de un ítem pertenece a uno de esos tipos."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT type FROM content.item_versions WHERE item_id = %s", (item_id,))
        tipos = [r["type"] for r in cur.fetchall()]
        assert tipos and all(t in TIPOS for t in tipos)
    with connect() as conn, conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
        cur.execute("UPDATE content.item_versions SET type = 'proyecto' WHERE item_id = %s", (item_id,))
    assert generar(content_client, docente, skill_ids[0]["id"], "proyecto").status_code == 400


# ---------- HU-25 Ver la puntuación de un ítem ----------

def test_hu25_c1_veo_el_promedio_de_las_puntuaciones_de_1_a_5(content_client, docente, skill_ids, fake_llm):
    """Veo el promedio de las puntuaciones (de 1 a 5 estrellas) del ítem."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    for valor in (1, 2, 4):
        content_client.put(f"/items/{item_id}/score", json={"score": valor}, headers=make_user(["validator"])["headers"])
    d = detalle(content_client, docente, item_id)
    assert 1.0 <= float(d["score"]["average"]) <= 5.0 and float(d["score"]["average"]) == 2.3  # (1 + 2 + 4) / 3


def test_hu25_c2_veo_la_cantidad_de_puntuaciones(content_client, docente, skill_ids, fake_llm):
    """Veo la cantidad de puntuaciones que recibió el ítem."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    for n in range(1, 4):
        content_client.put(f"/items/{item_id}/score", json={"score": 3}, headers=make_user(["validator"])["headers"])
        assert detalle(content_client, docente, item_id)["score"]["count"] == n


def test_hu25_c3_un_item_sin_puntuar_se_distingue_de_uno_con_promedio_1(content_client, docente, validador,
                                                                       skill_ids, fake_llm):
    """Un ítem sin puntuar se distingue de uno con promedio de 1 estrella."""
    sin = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    una = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    content_client.put(f"/items/{una}/score", json={"score": 1}, headers=validador["headers"])
    assert detalle(content_client, docente, sin)["score"] == {"average": None, "count": 0}
    assert detalle(content_client, docente, una)["score"] == {"average": 1.0, "count": 1}


def test_hu25_c4_un_item_sin_puntuar_igual_puede_mostrarse_y_usarse_si_esta_activo(content_client, docente, validador,
                                                                                   skill_ids, fake_llm):
    """Un ítem sin puntuar igual puede mostrarse y usarse si está activo."""
    item_id = crear_item(content_client, docente, fake_llm, skill_ids[0]["id"])
    for user in (docente, validador):
        d = detalle(content_client, user, item_id)
        assert d["status"] == "active" and d["score"]["count"] == 0
        assert item_id in ids_listados(content_client, user)


# ---------- HU-27 a HU-31: borradores antes de publicar (Generar ítems › Paso 3) ----------

def test_hu27_c1_los_borradores_muestran_enunciado_skill_nivel_tipo_y_tiempo(content_client, docente, skill_ids, fake_llm):
    """Los borradores se muestran en pantalla con su enunciado, skill, nivel, tipo y tiempo estimado."""
    fake_llm.respuestas = [llm_answer("open_question", 2)]
    d = borradores(content_client, docente, skill_ids[0]["id"], "open_question", count=2, level=5, minutes=15).json()
    assert d["skill_id"] == str(skill_ids[0]["id"]) and (d["level"], d["item_type"], d["estimated_minutes"]) == (5, "open_question", 15)
    assert all(x["statement"] and x["rubric"] for x in d["drafts"])


def test_hu27_c2_los_borradores_no_se_guardan_hasta_publicar(content_client, docente, skill_ids, fake_llm):
    """Los borradores no se guardan en el banco hasta que los publico."""
    fake_llm.respuestas = [llm_answer("true_false", 2)]
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    d = borradores(content_client, docente, skill_ids[0]["id"], "true_false", count=2).json()
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes
    publicar(content_client, docente, skill_ids[0]["id"], "true_false", d["drafts"])
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes + 2


def test_hu27_c3_si_la_ia_no_resuelve_un_pedido_veo_el_motivo_y_puedo_seguir(content_client, docente, skill_ids, fake_llm):
    """Si la IA no resuelve un pedido, veo el motivo y puedo seguir con los demás."""
    from shared.errors import BadGateway
    fake_llm.respuestas = [BadGateway("la IA no responde"), llm_answer("true_false", 1)]
    fallido = borradores(content_client, docente, skill_ids[0]["id"], "single_choice")
    assert fallido.status_code == 502 and fallido.json()["detail"] == "la IA no responde"
    assert borradores(content_client, docente, skill_ids[0]["id"], "true_false").status_code == 200  # los demás siguen
    # El portal lista cada pedido fallido y continúa con el resto: E2E (generar.mjs).


# c4 "Mi trabajo sin publicar se conserva en el navegador": E2E (tests/e2e/sesion.mjs, escenario 7).

def test_hu28_c1_y_c2_edito_enunciado_tiempo_respuesta_y_rubrica_y_se_publica_lo_editado(content_client, docente, skill_ids, fake_llm):
    """Puedo editar el enunciado, lo que evalúa, el tiempo estimado, la respuesta de referencia y la rúbrica; se publica lo que edité."""
    fake_llm.respuestas = [llm_answer("open_question", 1)]
    d = borradores(content_client, docente, skill_ids[0]["id"], "open_question").json()["drafts"][0]
    d["statement"], d["evaluation_goal"], d["reference_answer"] = "Enunciado editado", "Objetivo editado", "Referencia editada"
    d["rubric"][2]["name"] = "Criterio editado"  # los 2 primeros son fijos y no se pueden renombrar
    r = publicar(content_client, docente, skill_ids[0]["id"], "open_question", [d], minutes=33)  # el tiempo se edita por borrador
    item = detalle(content_client, docente, r.json()["items"][0]["id"])
    assert (item["statement"], item["evaluation_goal"], item["estimated_minutes"]) == ("Enunciado editado", "Objetivo editado", 33)
    assert item["content"]["reference_answer"] == "Referencia editada" and item["rubric"][2]["name"] == "Criterio editado"


@pytest.mark.parametrize("item_type,rotura", [
    ("open_question", lambda d: d["rubric"][0].update(weight=10)),                 # los pesos ya no suman 100
    ("single_choice", lambda d: [o.update(is_correct=True) for o in d["options"]]),  # más de una correcta
    ("debugging", lambda d: d.update(symptom_observed=d["symptom_expected"])),     # síntoma sin diferencia
])
def test_hu28_c3_lo_editado_debe_cumplir_las_reglas_y_si_no_no_se_publica_nada(content_client, docente, skill_ids,
                                                                              fake_llm, item_type, rotura):
    """Lo editado debe cumplir las mismas reglas que lo generado por la IA; si no, no se publica nada y veo el motivo."""
    fake_llm.respuestas = [llm_answer(item_type, 2)]
    drafts = borradores(content_client, docente, skill_ids[0]["id"], item_type, count=2).json()["drafts"]
    rotura(drafts[1])
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    r = publicar(content_client, docente, skill_ids[0]["id"], item_type, drafts)
    assert r.status_code == 400 and r.json()["detail"]
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes  # ni siquiera el ítem válido


def test_hu28_c4_lo_publicado_queda_como_version_1(content_client, docente, skill_ids, fake_llm):
    """Lo publicado queda como versión 1 del ítem."""
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    d = borradores(content_client, docente, skill_ids[0]["id"], "true_false").json()["drafts"]
    d[0]["statement"] = "Editado antes de publicar"
    item = detalle(content_client, docente, publicar(content_client, docente, skill_ids[0]["id"], "true_false", d).json()["items"][0]["id"])
    assert item["version"] == 1 and item["origin"] == "generated"
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM content.item_versions WHERE item_id = %s", (item["id"],))
        assert cur.fetchone()["n"] == 1  # la edición previa no creó versiones


def test_hu29_c1_a_c3_regenero_con_comentario_y_enunciado_previo_sin_guardar_nada(content_client, docente, skill_ids, fake_llm):
    """Puedo pedir otra versión con un comentario opcional; la IA recibe el enunciado anterior; el nuevo borrador reemplaza al anterior
    (en pantalla) y no se guarda nada en el banco."""
    fake_llm.respuestas = [llm_answer("true_false", 1), llm_answer("true_false", 1)]
    sid = skill_ids[0]["id"]
    primero = borradores(content_client, docente, sid, "true_false").json()["drafts"][0]
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    nuevo = borradores(content_client, docente, sid, "true_false", feedback="Más difícil", previous_statement=primero["statement"])
    assert nuevo.status_code == 200 and len(nuevo.json()["drafts"]) == 1
    assert "Más difícil" in fake_llm.prompts[1] and primero["statement"] in fake_llm.prompts[1]  # c1 y c2
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes       # c3: nada guardado
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    sin_comentario = borradores(content_client, docente, sid, "true_false", previous_statement="x")  # el comentario es opcional
    assert sin_comentario.status_code == 200 and "Comentario del usuario" not in fake_llm.prompts[2]


def test_hu30_c1_y_c3_lo_descartado_no_se_publica_y_el_contador_solo_cuenta_los_no_descartados(content_client, docente,
                                                                                               skill_ids, fake_llm):
    """Puedo descartar un borrador y no se publica; el botón de publicar cuenta solo los no descartados."""
    fake_llm.respuestas = [llm_answer("single_choice", 3)]
    drafts = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", count=3).json()["drafts"]
    descartado = drafts.pop(1)  # el portal simplemente no envía el descartado
    r = publicar(content_client, docente, skill_ids[0]["id"], "single_choice", drafts)
    assert len(r.json()["items"]) == len(drafts) == 2 and descartado  # publicó 2 de 3
    # El contador "Publicar N preguntas", el descarte y la restauración son de pantalla: E2E (generar.mjs).


def test_hu31_c1_publicar_guarda_los_items_activos_y_sin_puntuar(content_client, docente, skill_ids, fake_llm):
    """Publicar guarda los borradores no descartados como ítems activos y sin puntuar."""
    fake_llm.respuestas = [llm_answer("true_false", 2)]
    r = generar(content_client, docente, skill_ids[0]["id"], "true_false", count=2)
    assert r.status_code == 201 and len(r.json()["items"]) == 2
    for i in r.json()["items"]:
        d = detalle(content_client, docente, i["id"])
        assert d["status"] == "active" and d["score"] == {"average": None, "count": 0} and d["version"] == 1


def test_hu31_c2_disponible_para_expertos_o_uso_privado(content_client, docente, validador, skill_ids, fake_llm):
    """Si marco "disponible para expertos", los validadores ven los ítems; si no, son de uso privado y solo los ve su autor."""
    fake_llm.respuestas = [llm_answer("true_false", 1), llm_answer("true_false", 1)]
    abierto = generar(content_client, docente, skill_ids[0]["id"], "true_false", disponible=True).json()["items"][0]["id"]
    privado = generar(content_client, docente, skill_ids[0]["id"], "true_false", disponible=False).json()["items"][0]["id"]
    assert abierto in ids_listados(content_client, validador) and privado not in ids_listados(content_client, validador)
    assert content_client.get(f"/items/{privado}", headers=validador["headers"]).status_code == 404
    assert content_client.get(f"/items/{privado}", headers=docente["headers"]).status_code == 200  # su autor sí
    assert content_client.get(f"/items/{privado}", headers=make_user(["teacher_recruiter"])["headers"]).status_code == 404
    # Sin marcar la casilla, el ítem es privado por defecto:
    from tests.samples import SAMPLES
    por_defecto = content_client.post("/items/publish", headers=docente["headers"], json={"groups": [
        {"skill_id": str(skill_ids[0]["id"]), "level": 3, "item_type": "true_false", "estimated_minutes": 5,
         "items": [SAMPLES["true_false"]]}]})
    assert detalle(content_client, docente, por_defecto.json()["items"][0]["id"])["available_to_experts"] is False


# c3 "Tras publicar, la pantalla se bloquea y puedo generar más preguntas": E2E (generar.mjs).

def test_hu31_c4_si_algun_borrador_no_cumple_las_reglas_no_se_publica_ninguno(content_client, docente, skill_ids, fake_llm):
    """Si algún borrador no cumple las reglas, no se publica ninguno (también entre grupos distintos)."""
    from tests.samples import SAMPLES
    malo = {**SAMPLES["single_choice"], "options": [{"text": "A", "is_correct": False}, {"text": "B", "is_correct": False}]}
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    r = content_client.post("/items/publish", headers=docente["headers"], json={"available_to_experts": True, "groups": [
        {"skill_id": str(skill_ids[0]["id"]), "level": 3, "item_type": "true_false", "estimated_minutes": 5, "items": [SAMPLES["true_false"]]},
        {"skill_id": str(skill_ids[0]["id"]), "level": 3, "item_type": "single_choice", "estimated_minutes": 5, "items": [malo]}]})
    assert r.status_code == 400
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes
