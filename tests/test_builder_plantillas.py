"""HU-12 y HU-12-2: plantillas (copia del diseño), visibilidad y disponibilidad."""
from shared.db import connect
from tests.conftest import make_user
from tests.samples import SAMPLES
from tests.test_builder_evaluaciones import _borrador, _item, _put, _s, _sk


def _plantilla(builder_client, user, ev, visibilidad="private", confirmar=False, nombre="Mi plantilla"):
    return builder_client.post(f"/evaluations/{ev}/template", headers=user["headers"],
                               json={"name": nombre, "visibility": visibilidad, "make_items_public": confirmar})


def _con_item(builder_client, content_client, user, skill, **item):
    """Evaluación en borrador con un ítem; devuelve (evaluación, (item_id, item_version_id))."""
    it = _item(content_client, user, skill, **item)
    ev = _borrador(builder_client, user, [_sk(skill, 2, 5)], duration_minutes=40)
    _put(builder_client, user, ev, item_version_ids=[_s(it[1])])
    return ev, it


def test_una_plantilla_es_una_copia_independiente_que_se_puede_usar_y_borrar(builder_client, content_client, docente, skill_ids):
    ev, it = _con_item(builder_client, content_client, docente, skill_ids[0]["id"])
    r = _plantilla(builder_client, docente, ev)
    assert r.status_code == 201, r.text
    t = r.json()
    assert [(s["min_level"], s["max_level"]) for s in t["skills"]] == [(2, 5)] and t["duration_minutes"] == 40
    assert [i["item_version_id"] for i in t["items"]] == [_s(it[1])] and len(t["skills"]) == 1
    _put(builder_client, docente, ev, name="Cambiada", item_version_ids=[])  # la evaluación sigue su camino
    assert builder_client.get(f"/templates/{t['id']}", headers=docente["headers"]).json()["items_count"] == 1
    nueva = builder_client.post(f"/templates/{t['id']}/use", headers=docente["headers"], json={"name": "Desde plantilla"})
    assert nueva.status_code == 201, nueva.text
    n = nueva.json()
    assert n["id"] != ev and n["status"] == "draft" and n["name"] == "Desde plantilla" and len(n["items"]) == 1
    _put(builder_client, docente, n["id"], item_version_ids=[])  # y la plantilla no cambia al editar lo creado
    assert builder_client.get(f"/templates/{t['id']}", headers=docente["headers"]).json()["items_count"] == 1
    assert builder_client.delete(f"/templates/{t['id']}", headers=docente["headers"]).status_code == 200
    assert builder_client.get(f"/templates/{t['id']}", headers=docente["headers"]).status_code == 404
    assert builder_client.get(f"/evaluations/{n['id']}", headers=docente["headers"]).status_code == 200  # intactas


def test_una_plantilla_publica_exige_items_publicos(builder_client, content_client, docente, validador, skill_ids):
    ev, it = _con_item(builder_client, content_client, docente, skill_ids[0]["id"], disponible=False)
    assert content_client.get(f"/items/{it[0]}", headers=validador["headers"]).status_code == 404
    sin_confirmar = _plantilla(builder_client, docente, ev, "public")
    assert sin_confirmar.status_code == 400 and "privados" in sin_confirmar.json()["detail"]
    assert [t for t in builder_client.get("/templates", headers=docente["headers"]).json() if t["mine"]] == []  # nada a medias
    r = _plantilla(builder_client, docente, ev, "public", confirmar=True)  # confirmar hace públicos los ítems propios
    assert r.status_code == 201 and r.json()["visibility"] == "public"
    assert content_client.get(f"/items/{it[0]}", headers=validador["headers"]).status_code == 200
    otro = make_user(["teacher_recruiter"])  # los ítems privados de otro docente no se pueden publicar
    ev2, it2 = _con_item(builder_client, content_client, docente, skill_ids[0]["id"])
    _put(builder_client, docente, ev2, item_version_ids=[_s(it[1]), _s(it2[1])])
    ajeno = _item(content_client, otro, skill_ids[0]["id"])
    _put(builder_client, docente, ev2, item_version_ids=[_s(ajeno[1])])
    with connect() as conn, conn.cursor() as cur:
        cur.execute("UPDATE content.items SET available_to_experts = false WHERE id = %s", (ajeno[0],))
    r = _plantilla(builder_client, docente, ev2, "public", confirmar=True)
    assert r.status_code == 400 and "otros docentes" in r.json()["detail"]
    assert _plantilla(builder_client, docente, ev2, "private").status_code == 201  # privada sí


def test_las_plantillas_publicas_las_ven_y_usan_otros_docentes_y_las_privadas_no(
        builder_client, content_client, docente, validador, skill_ids):
    otro = make_user(["teacher_recruiter"])
    ev, it = _con_item(builder_client, content_client, docente, skill_ids[0]["id"])
    publica = _plantilla(builder_client, docente, ev, "public", nombre="Pública").json()
    privada = _plantilla(builder_client, docente, ev, "private", nombre="Privada").json()
    vistas = {t["id"]: t for t in builder_client.get("/templates", headers=otro["headers"]).json()}
    assert publica["id"] in vistas and privada["id"] not in vistas  # otras plantillas públicas de la BD no importan
    assert vistas[publica["id"]]["mine"] is False and vistas[publica["id"]]["owner_name"]
    assert builder_client.get(f"/templates/{privada['id']}", headers=otro["headers"]).status_code == 404
    usada = builder_client.post(f"/templates/{publica['id']}/use", headers=otro["headers"], json={})
    assert usada.status_code == 201 and len(usada.json()["items"]) == 1
    assert builder_client.get(f"/evaluations/{usada.json()['id']}", headers=otro["headers"]).status_code == 200
    assert builder_client.put(f"/templates/{publica['id']}", headers=otro["headers"], json={"name": "x"}).status_code == 404
    assert builder_client.delete(f"/templates/{publica['id']}", headers=otro["headers"]).status_code == 404
    r = builder_client.put(f"/templates/{publica['id']}", headers=docente["headers"], json={"visibility": "private"})
    assert r.status_code == 200
    assert publica["id"] not in [x["id"] for x in builder_client.get("/templates", headers=otro["headers"]).json()]
    assert builder_client.get("/templates", headers=validador["headers"]).status_code == 403


def test_un_item_desactivado_o_no_publico_deja_la_plantilla_no_disponible_hasta_que_se_corrige(
        builder_client, content_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    ev, it = _con_item(builder_client, content_client, docente, skill_ids[0]["id"])
    t = _plantilla(builder_client, docente, ev, "public").json()
    usar = lambda user: builder_client.post(f"/templates/{t['id']}/use", headers=user["headers"], json={})
    visibles = lambda user: [x["id"] for x in builder_client.get("/templates", headers=user["headers"]).json()]
    content_client.patch(f"/items/{it[0]}/status", json={"status": "inactive"}, headers=docente["headers"])
    assert t["id"] not in visibles(otro) and usar(otro).status_code == 404
    mia = next(x for x in builder_client.get("/templates", headers=docente["headers"]).json() if x["id"] == t["id"])
    assert mia["available"] is False and mia["blocked_items"][0]["reason"] == "inactivo"
    assert usar(docente).status_code == 400
    content_client.patch(f"/items/{it[0]}/status", json={"status": "active"}, headers=docente["headers"])
    assert t["id"] in visibles(otro) and usar(otro).status_code == 201  # al reactivarlo, vuelve sola
    content_client.put(f"/items/{it[0]}", headers=docente["headers"], json={  # el autor lo vuelve privado al editarlo
        "item": SAMPLES["single_choice"], "estimated_minutes": 10, "available_to_experts": False})
    mia = next(x for x in builder_client.get("/templates", headers=docente["headers"]).json() if x["id"] == t["id"])
    assert t["id"] not in visibles(otro) and mia["available"] is False and mia["blocked_items"][0]["reason"] == "no público"


def test_validaciones_de_las_plantillas(builder_client, content_client, docente, skill_ids):
    ev, _ = _con_item(builder_client, content_client, docente, skill_ids[0]["id"])
    assert _plantilla(builder_client, docente, ev, "secreta").status_code == 400
    assert _plantilla(builder_client, docente, ev, nombre="  ").status_code == 400
    t = _plantilla(builder_client, docente, ev).json()
    assert builder_client.put(f"/templates/{t['id']}", headers=docente["headers"], json={"visibility": "x"}).status_code == 400
    r = builder_client.put(f"/templates/{t['id']}", headers=docente["headers"], json={"name": "Renombrada", "duration_minutes": 55})
    assert r.status_code == 200 and r.json()["name"] == "Renombrada" and r.json()["duration_minutes"] == 55
