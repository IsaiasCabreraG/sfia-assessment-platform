"""HU-13, HU-14, HU-15 y HU-26: editar y regenerar ítems crea versiones; los ajenos se copian."""
import copy

from shared.db import connect
from tests.conftest import make_user
from tests.helpers import generar
from tests.samples import SAMPLES, llm_answer


def _item(content_client, user, skill_id, fake_llm, item_type="open_question", disponible=True):
    fake_llm.respuestas = [llm_answer(item_type, 1)]
    r = generar(content_client, user, skill_id, item_type, disponible=disponible)
    assert r.status_code == 201, r.text
    return r.json()["items"][0]["id"]


def _edicion(item_type="open_question", **extra):
    contenido = copy.deepcopy(SAMPLES[item_type])
    contenido["statement"] = "Enunciado editado"
    return {"item": contenido, "estimated_minutes": 12, "available_to_experts": True, **extra}


def test_editar_un_item_propio_crea_la_version_2_y_conserva_la_puntuacion_de_la_1(
        content_client, docente, validador, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    content_client.put(f"/items/{item_id}/score", json={"score": 4}, headers=validador["headers"])
    r = content_client.put(f"/items/{item_id}", json=_edicion(), headers=docente["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["id"] == item_id and r.json()["version"] == 2 and r.json()["copy"] is False
    d = content_client.get(f"/items/{item_id}", headers=docente["headers"]).json()
    assert d["version"] == 2 and d["origin"] == "edited" and d["statement"] == "Enunciado editado"
    assert d["estimated_minutes"] == 12 and d["score"] == {"average": None, "count": 0}  # la nueva parte sin puntuar
    versiones = content_client.get(f"/items/{item_id}/versions", headers=docente["headers"]).json()["versions"]
    assert [v["version"] for v in versiones] == [2, 1]
    assert [v["origin"] for v in versiones] == ["edited", "generated"]
    assert versiones[1]["count"] == 1 and float(versiones[1]["average"]) == 4  # la 1 conserva su puntuación
    v1 = content_client.get(f"/items/{item_id}?version=1", headers=docente["headers"]).json()  # una versión concreta
    assert v1["version"] == 1 and v1["latest_version"] == 2 and v1["statement"] != "Enunciado editado"
    assert v1["score"]["count"] == 1 and v1["origin"] == "generated"
    assert content_client.get(f"/items/{item_id}?version=2", headers=docente["headers"]).json()["statement"] == "Enunciado editado"
    assert content_client.get(f"/items/{item_id}?version=9", headers=docente["headers"]).status_code == 404


def test_editar_un_item_ajeno_crea_una_copia_propia_y_no_toca_el_original(content_client, docente, skill_ids, fake_llm):
    autor = make_user(["teacher_recruiter"])
    original = _item(content_client, autor, skill_ids[0]["id"], fake_llm)
    r = content_client.put(f"/items/{original}", json=_edicion(available_to_experts=False), headers=docente["headers"])
    assert r.status_code == 201, r.text
    copia = r.json()
    assert copia["copy"] is True and copia["id"] != original and copia["version"] == 1
    d = content_client.get(f"/items/{copia['id']}", headers=docente["headers"]).json()
    assert d["is_mine"] is True and d["source_item_id"] == original and d["origin"] == "edited"
    assert d["available_to_experts"] is False
    o = content_client.get(f"/items/{original}", headers=autor["headers"]).json()
    assert o["version"] == 1 and o["statement"] != "Enunciado editado" and o["is_mine"] is True


def test_al_guardar_se_vuelve_a_decidir_la_disponibilidad(content_client, docente, validador, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm, disponible=True)
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 200
    content_client.put(f"/items/{item_id}", json=_edicion(available_to_experts=False), headers=docente["headers"])
    assert content_client.get(f"/items/{item_id}", headers=validador["headers"]).status_code == 404


def test_contenido_invalido_responde_400_y_no_crea_nada(content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    malo = _edicion()
    malo["item"]["reference_answer"] = ""
    assert content_client.put(f"/items/{item_id}", json=malo, headers=docente["headers"]).status_code == 400
    versiones = content_client.get(f"/items/{item_id}/versions", headers=docente["headers"]).json()["versions"]
    assert len(versiones) == 1


def test_regenerar_exige_contexto_y_lo_guarda_junto_a_la_version(content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    sin = content_client.put(f"/items/{item_id}", json=_edicion(origin="regenerated"), headers=docente["headers"])
    assert sin.status_code == 400
    ok = content_client.put(f"/items/{item_id}", headers=docente["headers"],
                            json=_edicion(origin="regenerated", context="Banco chileno"))
    assert ok.status_code == 201, ok.text
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT v.origin, r.context FROM content.item_versions v "
                    "JOIN content.generation_requests r ON r.id = v.generation_request_id "
                    "WHERE v.id = %s", (ok.json()["version_id"],))
        assert cur.fetchone() == {"origin": "regenerated", "context": "Banco chileno"}


def test_editar_conserva_tipo_skill_y_nivel(content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm, item_type="true_false")
    antes = content_client.get(f"/items/{item_id}", headers=docente["headers"]).json()
    r = content_client.put(f"/items/{item_id}", headers=docente["headers"], json=_edicion("true_false"))
    assert r.status_code == 201, r.text
    despues = content_client.get(f"/items/{item_id}", headers=docente["headers"]).json()
    assert (despues["type"], despues["skill"], despues["level"]) == (antes["type"], antes["skill"], antes["level"])


def test_mine_lista_solo_los_items_del_docente(content_client, docente, skill_ids, fake_llm):
    otro = make_user(["teacher_recruiter"])
    ajeno = _item(content_client, otro, skill_ids[0]["id"], fake_llm)
    propio = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    todos = {i["id"] for i in content_client.get("/items?limit=200", headers=docente["headers"]).json()["items"]}
    mios = {i["id"] for i in content_client.get("/items?mine=true&limit=200", headers=docente["headers"]).json()["items"]}
    assert {propio, ajeno} <= todos and propio in mios and ajeno not in mios


def test_un_validador_no_puede_editar_y_un_ajeno_inactivo_no_se_copia(
        content_client, docente, validador, skill_ids, fake_llm):
    autor = make_user(["teacher_recruiter"])
    item_id = _item(content_client, autor, skill_ids[0]["id"], fake_llm)
    assert content_client.put(f"/items/{item_id}", json=_edicion(), headers=validador["headers"]).status_code == 403
    content_client.patch(f"/items/{item_id}/status", json={"status": "inactive"}, headers=autor["headers"])
    assert content_client.put(f"/items/{item_id}", json=_edicion(), headers=docente["headers"]).status_code == 404


# ---------- HU-14: regenerar con un nuevo contexto (vista previa) ----------

def _versiones(content_client, user, item_id):
    return content_client.get(f"/items/{item_id}/versions", headers=user["headers"]).json()["versions"]


def test_la_vista_previa_no_guarda_nada_y_usa_el_nuevo_contexto(content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    fake_llm.respuestas = [llm_answer("open_question", 1)]
    r = content_client.post(f"/items/{item_id}/regenerate", json={"context": "Banco chileno"},
                            headers=docente["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["item_type"] == "open_question" and r.json()["draft"]["statement"]
    assert len(_versiones(content_client, docente, item_id)) == 1  # no se guardó nada
    # los tipos abiertos usan dos llamadas: el prompt con el contexto es el de los ítems, no el último
    assert any("Banco chileno" in p and "Enunciado de prueba" in p for p in fake_llm.prompts)


def test_regenerar_sin_contexto_responde_400(content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    for vacio in ("", "   "):
        r = content_client.post(f"/items/{item_id}/regenerate", json={"context": vacio}, headers=docente["headers"])
        assert r.status_code == 400


def test_regenerar_conserva_la_respuesta_correcta(content_client, docente, skill_ids, fake_llm):
    alt = _item(content_client, docente, skill_ids[0]["id"], fake_llm, item_type="single_choice")
    opciones = content_client.get(f"/items/{alt}", headers=docente["headers"]).json()["content"]["options"]
    letra = "ABCD"[next(o["position"] for o in opciones if o["is_correct"]) - 1]
    fake_llm.respuestas = [llm_answer("single_choice", 1)]
    content_client.post(f"/items/{alt}/regenerate", json={"context": "Retail"}, headers=docente["headers"])
    assert f"ítem 1 → {letra}" in fake_llm.prompts[-1]  # pide la misma correcta que tenía el original
    vf = _item(content_client, docente, skill_ids[0]["id"], fake_llm, item_type="true_false")
    correcta = content_client.get(f"/items/{vf}", headers=docente["headers"]).json()["content"]["correct_answer"]
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    content_client.post(f"/items/{vf}/regenerate", json={"context": "Retail"}, headers=docente["headers"])
    assert f"ítem 1 → {'verdadero' if correcta else 'falso'}" in fake_llm.prompts[-1]


def test_regenerar_validador_403_y_un_item_publico_ajeno_si_se_previsualiza(
        content_client, docente, validador, skill_ids, fake_llm):
    autor = make_user(["teacher_recruiter"])
    item_id = _item(content_client, autor, skill_ids[0]["id"], fake_llm)
    assert content_client.post(f"/items/{item_id}/regenerate", json={"context": "x"},
                               headers=validador["headers"]).status_code == 403
    fake_llm.respuestas = [llm_answer("open_question", 1)]
    assert content_client.post(f"/items/{item_id}/regenerate", json={"context": "x"},
                               headers=docente["headers"]).status_code == 200


def test_flujo_completo_vista_previa_y_confirmar_crea_la_version_regenerated(
        content_client, docente, skill_ids, fake_llm):
    item_id = _item(content_client, docente, skill_ids[0]["id"], fake_llm)
    fake_llm.respuestas = [llm_answer("open_question", 1)]
    previa = content_client.post(f"/items/{item_id}/regenerate", json={"context": "Seguros"},
                                 headers=docente["headers"]).json()
    r = content_client.put(f"/items/{item_id}", headers=docente["headers"], json={
        "item": previa["draft"], "estimated_minutes": previa["estimated_minutes"],
        "available_to_experts": True, "origin": "regenerated", "context": previa["context"]})
    assert r.status_code == 201, r.text
    v = _versiones(content_client, docente, item_id)
    assert [x["version"] for x in v] == [2, 1] and v[0]["origin"] == "regenerated"
