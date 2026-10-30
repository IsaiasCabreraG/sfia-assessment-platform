"""HU-03 a HU-10 y HU-25: generación con IA, banco de ítems, filtros, estado y puntuación."""
import json

import pytest

from content.types import ITEM_TYPES
from shared.db import connect
from tests.conftest import make_user
from tests.helpers import borradores, generar, publicar
from tests.samples import SAMPLES, llm_answer


_generar = generar


# ---------- HU-10: tipos ----------

def test_el_banco_soporta_los_seis_tipos(content_client, docente):
    tipos = content_client.get("/item-types", headers=docente["headers"]).json()
    assert {t["type"] for t in tipos} == set(ITEM_TYPES) and len(tipos) == 6


@pytest.mark.parametrize("item_type", list(SAMPLES))
def test_generar_cada_tipo_guarda_version_1_sin_puntuar(content_client, docente, skill_ids, fake_llm, item_type):
    """HU-03, HU-04, HU-06, HU-10: ítems de la skill y nivel pedidos, borradores sin puntuar."""
    fake_llm.respuestas = [llm_answer(item_type, 2)]
    r = _generar(content_client, docente, skill_ids[0]["id"], item_type, count=2, level=4, minutes=15)
    assert r.status_code == 201, r.text
    assert len(r.json()["items"]) == 2
    detalle = content_client.get(f"/items/{r.json()['items'][0]['id']}", headers=docente["headers"]).json()
    assert detalle["type"] == item_type and detalle["version"] == 1 and detalle["origin"] == "generated"
    assert detalle["skill"]["code"] == skill_ids[0]["code"] and detalle["level"] == 4
    assert detalle["estimated_minutes"] == 15 and detalle["status"] == "active"
    assert detalle["score"] == {"average": None, "count": 0}


def test_el_prompt_lleva_skill_nivel_tiempo_cantidad_y_contexto(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 3)]
    _generar(content_client, docente, skill_ids[0]["id"], "true_false", count=3, level=5, minutes=7,
             context="Fintech chilena")
    prompt = fake_llm.prompts[0]
    for esperado in (skill_ids[0]["code"], "Nivel de responsabilidad: 5", "7 minutos", "Genera 3", "Fintech chilena"):
        assert esperado in prompt


# ---------- Validación y fallos de la IA ----------

def test_respuesta_invalida_se_reintenta_una_vez(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = ["esto no es json", "```json\n" + llm_answer("true_false", 1) + "\n```"]
    r = _generar(content_client, docente, skill_ids[0]["id"], "true_false")
    assert r.status_code == 201 and len(fake_llm.prompts) == 2 and "rechazada" in fake_llm.prompts[1]


def test_si_la_ia_sigue_fallando_no_se_guarda_nada(content_client, docente, skill_ids, fake_llm):
    malo = json.dumps({"items": [{**SAMPLES["single_choice"], "options": [{"text": "A", "is_correct": True},
                                                                        {"text": "B", "is_correct": True}]}]})
    fake_llm.respuestas = [malo, malo]
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    r = _generar(content_client, docente, skill_ids[0]["id"])
    assert r.status_code == 502 and "exactamente una opción" in r.json()["detail"]
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes


def test_cantidad_incorrecta_de_la_ia_se_rechaza(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 1), llm_answer("true_false", 1)]
    assert _generar(content_client, docente, skill_ids[0]["id"], "true_false", count=3).status_code == 502


def test_modulo_llm_caido_no_reintenta(content_client, docente, skill_ids, fake_llm):
    from shared.errors import BadGateway
    fake_llm.respuestas = [BadGateway("llm caído")]
    r = _generar(content_client, docente, skill_ids[0]["id"])
    assert r.status_code == 502 and len(fake_llm.prompts) == 1 and r.json()["detail"] == "llm caído"


@pytest.mark.parametrize("cambio", [{"level": 8}, {"item_type": "otro"}, {"item_count": 0}, {"item_count": 11},
                                    {"estimated_minutes": 0}])
def test_pedido_invalido_es_400_y_no_llama_a_la_ia(content_client, docente, skill_ids, fake_llm, cambio):
    body = {"skill_id": str(skill_ids[0]["id"]), "level": 3, "item_type": "single_choice", "item_count": 1,
            "estimated_minutes": 10, **cambio}
    assert content_client.post("/drafts", headers=docente["headers"], json=body).status_code == 400
    assert fake_llm.prompts == []


def test_skill_inexistente_es_404(content_client, docente, fake_llm):
    assert _generar(content_client, docente, "00000000-0000-0000-0000-000000000000").status_code == 404


def test_solo_docente_genera(content_client, validador, skill_ids, fake_llm):
    assert _generar(content_client, validador, skill_ids[0]["id"]).status_code == 403


# ---------- HU-08: atributos ----------

def _crear(content_client, docente, skill_id, item_type, fake_llm):
    fake_llm.respuestas = [llm_answer(item_type, 1)]
    r = _generar(content_client, docente, skill_id, item_type)
    return r.json()["items"][0]["id"]


def test_detalle_de_alternativa_unica_muestra_la_correcta(content_client, docente, validador, skill_ids, fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "single_choice", fake_llm)
    d = content_client.get(f"/items/{item_id}", headers=validador["headers"]).json()
    assert [o["is_correct"] for o in d["content"]["options"]] == [False, True, False]
    assert d["rubric"] is None and d["statement"] and d["estimated_minutes"] == 10


def test_system_design_muestra_rubrica_y_respuesta_de_referencia(content_client, docente, validador, skill_ids,
                                                                 fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "system_design", fake_llm)
    d = content_client.get(f"/items/{item_id}", headers=validador["headers"]).json()
    assert d["content"]["reference_answer"] and d["content"]["scenario"]
    assert sum(c["weight"] for c in d["rubric"]) == 100 and len(d["rubric"][0]["levels"]) == 4


@pytest.mark.parametrize("item_type,campo", [("open_question", "reference_answer"), ("debugging", "reference_answer"), ("system_design", "reference_answer"),
                                             ("coding", "reference_solution"), ("true_false", "correct_answer")])
def test_detalle_muestra_la_respuesta_correcta_de_los_demas_tipos(content_client, docente, validador, skill_ids,
                                                                  fake_llm, item_type, campo):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], item_type, fake_llm)
    d = content_client.get(f"/items/{item_id}", headers=validador["headers"]).json()
    assert d["content"][campo] is not None
    assert (d["rubric"] is not None) == (item_type in ("open_question", "debugging", "system_design"))


# ---------- HU-09: estado ----------

def test_desactivar_oculta_el_item_al_validador(content_client, docente, validador, skill_ids, fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    assert content_client.patch(f"/items/{item_id}/status", json={"status": "inactive"},
                                headers=docente["headers"]).status_code == 200
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 404
    ids = [i["id"] for i in content_client.get("/items", headers=validador["headers"]).json()["items"]]
    assert item_id not in ids
    # el docente sí lo ve si pide los inactivos
    r = content_client.get("/items", params={"status": "inactive"}, headers=docente["headers"]).json()
    assert item_id in [i["id"] for i in r["items"]]
    assert content_client.patch(f"/items/{item_id}/status", json={"status": "x"}, headers=docente["headers"]).status_code == 400


def test_el_validador_no_cambia_el_estado(content_client, docente, validador, skill_ids, fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    assert content_client.patch(f"/items/{item_id}/status", json={"status": "inactive"},
                                headers=validador["headers"]).status_code == 403


# ---------- HU-05 y HU-25: puntuación ----------

def test_puntuar_promedio_y_cantidad(content_client, docente, validador, skill_ids, fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    otro = make_user(["validator"])
    r = content_client.put(f"/items/{item_id}/score", json={"score": 0.0}, headers=validador["headers"])
    assert r.status_code == 200 and r.json()["count"] == 1 and float(r.json()["average"]) == 0.0  # 0.0 ≠ sin puntuar
    content_client.put(f"/items/{item_id}/score", json={"score": 4.5}, headers=otro["headers"])
    d = content_client.get(f"/items/{item_id}", headers=docente["headers"]).json()
    assert d["score"]["count"] == 2 and float(d["score"]["average"]) == 2.3  # promedio de 0.0 y 4.5
    # volver a puntuar reemplaza, no suma
    content_client.put(f"/items/{item_id}/score", json={"score": 5.0}, headers=validador["headers"])
    d = content_client.get(f"/items/{item_id}", headers=validador["headers"]).json()
    assert d["score"]["count"] == 2 and float(d["my_score"]) == 5.0


@pytest.mark.parametrize("valor", [-0.1, 5.1, 2.55])
def test_puntuacion_fuera_de_rango_o_con_dos_decimales(content_client, docente, validador, skill_ids, fake_llm, valor):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    assert content_client.put(f"/items/{item_id}/score", json={"score": valor},
                              headers=validador["headers"]).status_code == 400


def test_solo_validador_puntua(content_client, docente, skill_ids, fake_llm):
    item_id = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    assert content_client.put(f"/items/{item_id}/score", json={"score": 3}, headers=docente["headers"]).status_code == 403


# ---------- HU-07: filtros ----------

def test_filtros_por_skill_puntuacion_y_sin_puntuar(content_client, docente, validador, skill_ids, fake_llm):
    a = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    b = _crear(content_client, docente, skill_ids[1]["id"], "true_false", fake_llm)
    content_client.put(f"/items/{a}/score", json={"score": 0.0}, headers=validador["headers"])
    h = validador["headers"]

    def ids(**params):
        return {i["id"] for i in content_client.get("/items", params=params, headers=h).json()["items"]}

    assert {a, b} <= ids(limit=200) and a in ids(skill_id=str(skill_ids[0]["id"])) and b not in ids(skill_id=str(skill_ids[0]["id"]))
    assert a in ids(scored="scored", limit=200) and b not in ids(scored="scored", limit=200)
    assert b in ids(scored="unscored", limit=200) and a not in ids(scored="unscored", limit=200)
    assert a in ids(min_score=0, max_score=1, limit=200) and a not in ids(min_score=1, limit=200)  # 0.0 es puntuado
    assert b not in ids(min_score=0, limit=200)  # un ítem sin puntuar no entra en un filtro por puntaje


def test_filtro_por_rol_se_resuelve_por_las_skills_del_perfil(content_client, docente, validador, skill_ids, fake_llm):
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT profile_id FROM catalog.role_profile_skills WHERE skill_id = %s LIMIT 1", (skill_ids[0]["id"],))
        perfil = cur.fetchone()["profile_id"]
        cur.execute("SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = %s", (perfil,))
        del_perfil = {r["skill_id"] for r in cur.fetchall()}
    dentro = _crear(content_client, docente, skill_ids[0]["id"], "true_false", fake_llm)
    r = content_client.get("/items", params={"role_profile_id": str(perfil), "limit": 200}, headers=validador["headers"]).json()
    assert dentro in [i["id"] for i in r["items"]]
    assert all(i["skill_id"] in {str(s) for s in del_perfil} for i in r["items"])


# ---------- Borradores: revisar, editar y publicar ----------

def test_los_borradores_no_se_guardan_hasta_publicar(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 2)]
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    r = borradores(content_client, docente, skill_ids[0]["id"], "true_false", count=2)
    assert r.status_code == 200 and len(r.json()["drafts"]) == 2
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes
    assert publicar(content_client, docente, skill_ids[0]["id"], "true_false", r.json()["drafts"]).status_code == 201
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes + 2


def test_lo_editado_antes_de_publicar_es_lo_que_se_guarda(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("single_choice", 2)]
    drafts = borradores(content_client, docente, skill_ids[0]["id"], count=2).json()["drafts"]
    drafts[0]["statement"] = "Enunciado corregido por el autor"
    drafts[0]["options"][0]["text"] = "Opción editada"
    publicado = publicar(content_client, docente, skill_ids[0]["id"], "single_choice", drafts[:1])  # el 2.º se descartó
    assert len(publicado.json()["items"]) == 1
    d = content_client.get(f"/items/{publicado.json()['items'][0]['id']}", headers=docente["headers"]).json()
    assert d["statement"] == "Enunciado corregido por el autor" and d["content"]["options"][0]["text"] == "Opción editada"


def test_una_edicion_invalida_se_rechaza_y_no_guarda_nada(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("open_question", 2)]
    drafts = borradores(content_client, docente, skill_ids[0]["id"], "open_question", count=2).json()["drafts"]
    drafts[1]["rubric"][0]["weight"] = 10  # los pesos ya no suman 100
    antes = content_client.get("/items", headers=docente["headers"]).json()["total"]
    r = publicar(content_client, docente, skill_ids[0]["id"], "open_question", drafts)
    assert r.status_code == 400 and "100" in r.json()["detail"]
    assert content_client.get("/items", headers=docente["headers"]).json()["total"] == antes


def test_regenerar_un_borrador_envia_el_feedback_y_el_enunciado_previo(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "true_false", count=1,
                   feedback="Hazla sobre bases de datos", previous_statement="Enunciado viejo")
    assert r.status_code == 200
    assert "Hazla sobre bases de datos" in fake_llm.prompts[0] and "Enunciado viejo" in fake_llm.prompts[0]


def test_publicar_exige_docente_y_al_menos_un_item(content_client, validador, docente, skill_ids):
    assert publicar(content_client, validador, skill_ids[0]["id"], "true_false", []).status_code == 403
    assert publicar(content_client, docente, skill_ids[0]["id"], "true_false", []).status_code == 400


# ---------- Casilla "disponible para expertos" ----------

def test_un_item_de_uso_privado_solo_lo_ve_su_autor(content_client, docente, validador, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    r = generar(content_client, docente, skill_ids[0]["id"], "true_false", disponible=False)
    item_id = r.json()["items"][0]["id"]
    assert content_client.get(f"/items/{item_id}", headers=docente["headers"]).json()["available_to_experts"] is False
    assert item_id in {i["id"] for i in content_client.get("/items", params={"limit": 200}, headers=docente["headers"]).json()["items"]}
    assert item_id not in {i["id"] for i in content_client.get("/items", params={"limit": 200}, headers=validador["headers"]).json()["items"]}
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 404
    assert content_client.put(f"/items/{item_id}/score", json={"score": 3}, headers=validador["headers"]).status_code == 404
    otro_docente = make_user(["teacher_recruiter"])  # tampoco lo ve otro docente
    assert content_client.get(f"/items/{item_id}", headers=otro_docente["headers"]).status_code == 404


def test_un_item_disponible_para_expertos_lo_ven_los_validadores(content_client, docente, validador, skill_ids,
                                                                 fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    item_id = generar(content_client, docente, skill_ids[0]["id"], "true_false", disponible=True).json()["items"][0]["id"]
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 200
    assert content_client.put(f"/items/{item_id}/score", json={"score": 3}, headers=validador["headers"]).status_code == 200


# ---------- Plantilla del prompt (prompt.json) ----------

def test_el_prompt_envia_la_descripcion_completa_sin_recortar():
    from content.generation.prompts import build_prompt
    larga = "palabra " * 400 + "FIN"   # más de 1.500 caracteres
    prompt = build_prompt(skill={"code": "X", "name": "N", "description": larga}, level=3, level_title="Apply",
                          item_type="true_false", count=1, estimated_minutes=1, context=None)
    assert larga.strip() in prompt and prompt.count("FIN") == 1


def test_el_prompt_solo_incluye_lo_opcional_si_existe():
    from content.generation.prompts import build_prompt
    skill = {"code": "X", "name": "N", "description": "D"}
    base = dict(skill=skill, level=3, level_title="Apply", item_type="coding", count=1, estimated_minutes=25)
    simple = build_prompt(context=None, **base)
    for frase in ("Contexto indicado", "Estás regenerando", "Comentario del usuario", "rechazada"):
        assert frase not in simple
    completo = build_prompt(context="Banco", feedback="más difícil", previous_statement="Enunciado previo", previous_error="x", **base)
    for frase in ("Contexto indicado por el usuario: Banco", "cuyo enunciado era: Enunciado previo",
                  "Comentario del usuario para esta versión: más difícil", "corrígelos: x"):
        assert frase in completo


def test_prompt_json_cubre_los_seis_tipos():
    from content.generation.prompts import PROMPT
    from content.types import ITEM_TYPES
    assert set(PROMPT["reglas_por_tipo"]) == set(PROMPT["forma_json_por_tipo"]) == set(ITEM_TYPES)


