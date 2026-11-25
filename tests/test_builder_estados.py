"""HU-12-3: publicar, descartar y duplicar evaluaciones."""
from tests.conftest import make_user
from tests.samples import SAMPLES
from tests.test_builder_evaluaciones import _borrador, _item, _put, _s


def _con_items(builder_client, content_client, user, skill, cuantos=2, **campos):
    ids = [_item(content_client, user, skill) for _ in range(cuantos)]
    ev = _borrador(builder_client, user, [skill], **campos)
    _put(builder_client, user, ev, item_version_ids=[_s(i[1]) for i in ids])
    return ev, ids


def _post(builder_client, user, ev, accion, **cuerpo):
    return builder_client.post(f"/evaluations/{ev}/{accion}", headers=user["headers"], json=cuerpo)


def test_publicar_exige_items_activos_fija_la_duracion_y_bloquea_la_edicion(builder_client, content_client, docente, skill_ids):
    vacia = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    assert _post(builder_client, docente, vacia, "publish").status_code == 400  # sin ítems
    ev, ids = _con_items(builder_client, content_client, docente, skill_ids[0]["id"])
    content_client.patch(f"/items/{ids[0][0]}/status", json={"status": "inactive"}, headers=docente["headers"])
    assert _post(builder_client, docente, ev, "publish").status_code == 400  # un ítem inactivo
    content_client.patch(f"/items/{ids[0][0]}/status", json={"status": "active"}, headers=docente["headers"])
    r = _post(builder_client, docente, ev, "publish")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "published" and d["published_at"] and d["share_token"] is None  # sin link por ahora
    assert d["duration_minutes"] == d["recommended_minutes"] == 20  # la duración vacía queda en la recomendada
    assert _put(builder_client, docente, ev, name="x").status_code == 400  # una publicada no se edita
    assert _post(builder_client, docente, ev, "publish").status_code == 400  # ni se publica de nuevo
    otra, _ = _con_items(builder_client, content_client, docente, skill_ids[0]["id"], cuantos=1, duration_minutes=99)
    assert _post(builder_client, docente, otra, "publish").json()["duration_minutes"] == 99  # la que se fijó se respeta


def test_descartar_saca_la_evaluacion_de_las_disponibles(builder_client, content_client, docente, skill_ids):
    borrador = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    publicada, _ = _con_items(builder_client, content_client, docente, skill_ids[0]["id"], cuantos=1)
    _post(builder_client, docente, publicada, "publish")
    for ev in (borrador, publicada):
        assert _post(builder_client, docente, ev, "discard").json()["status"] == "discarded"
    ids = lambda **q: [e["id"] for e in builder_client.get("/evaluations", headers=docente["headers"], params=q).json()]
    assert borrador not in ids() and publicada not in ids()  # por defecto no se listan
    assert {borrador, publicada} <= set(ids(status="discarded"))
    assert _post(builder_client, docente, borrador, "discard").status_code == 400  # ya descartada
    assert _post(builder_client, docente, borrador, "publish").status_code == 400
    assert _put(builder_client, docente, borrador, name="x").status_code == 400


def test_duplicar_crea_un_borrador_editable_con_el_mismo_diseno(builder_client, content_client, docente, skill_ids):
    ev, ids = _con_items(builder_client, content_client, docente, skill_ids[0]["id"], duration_minutes=45)
    _post(builder_client, docente, ev, "publish")
    r = _post(builder_client, docente, ev, "duplicate")
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["id"] != ev and d["status"] == "draft" and d["name"].endswith("(copia)") and d["share_token"] is None
    assert [i["item_version_id"] for i in d["items"]] == [_s(i[1]) for i in ids]
    assert d["skills"] == builder_client.get(f"/evaluations/{ev}", headers=docente["headers"]).json()["skills"]
    assert d["duration_minutes"] == 45
    assert _put(builder_client, docente, d["id"], item_version_ids=[]).status_code == 200  # el duplicado sí se edita
    original = builder_client.get(f"/evaluations/{ev}", headers=docente["headers"]).json()
    assert original["status"] == "published" and len(original["items"]) == 2  # y el original no cambia
    assert _post(builder_client, docente, ev, "duplicate", name="Mi versión 2").json()["name"] == "Mi versión 2"


def test_el_uso_de_un_item_cuenta_evaluaciones_publicadas_y_plantillas_publicas(
        builder_client, content_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    ev, ids = _con_items(builder_client, content_client, docente, skill_ids[0]["id"], cuantos=1)
    item = ids[0][0]
    uso = lambda user: builder_client.get(f"/items/{item}/usage", headers=user["headers"])
    assert uso(docente).json() == {"item_id": item, "published_evaluations": 0, "public_templates": 0}  # un borrador no cuenta
    _post(builder_client, docente, ev, "publish")
    builder_client.post(f"/evaluations/{ev}/template", headers=docente["headers"],
                        json={"name": "Pública", "visibility": "public"})
    builder_client.post(f"/evaluations/{ev}/template", headers=docente["headers"], json={"name": "Privada"})
    assert uso(otro).json()["published_evaluations"] == 1 and uso(otro).json()["public_templates"] == 1  # lo ve otro docente
    content_client.patch(f"/items/{item}/status", json={"status": "inactive"}, headers=docente["headers"])
    assert builder_client.get(f"/evaluations/{ev}", headers=docente["headers"]).json()["status"] == "published"  # no cambia
    privado = _item(content_client, otro, skill_ids[0]["id"], disponible=False)
    assert uso(docente).status_code == 200 and builder_client.get(f"/items/{privado[0]}/usage", headers=docente["headers"]).status_code == 404
