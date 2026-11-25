"""HU-38: roles propios (skills elegidas guardadas para reutilizarlas), solo privados."""
import uuid

from tests.conftest import make_user


def _crear(builder_client, user, nombre, skills):
    return builder_client.post("/custom-roles", headers=user["headers"],
                               json={"name": nombre, "skill_ids": [str(s) for s in skills]})


def test_crear_un_rol_devuelve_sus_skills_ordenadas_por_codigo(builder_client, docente, skill_ids):
    ids = [skill_ids[1]["id"], skill_ids[0]["id"]]
    r = _crear(builder_client, docente, "Mi rol", ids)
    assert r.status_code == 201, r.text
    assert [s["code"] for s in r.json()["skills"]] == sorted(s["code"] for s in skill_ids)
    detalle = builder_client.get(f"/custom-roles/{r.json()['id']}", headers=docente["headers"])
    assert detalle.status_code == 200 and detalle.json()["name"] == "Mi rol"


def test_cada_docente_ve_solo_sus_roles_con_la_cantidad_de_skills(builder_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    _crear(builder_client, docente, "Propio", [skill_ids[0]["id"], skill_ids[1]["id"]])
    _crear(builder_client, otro, "Ajeno", [skill_ids[0]["id"]])
    roles = builder_client.get("/custom-roles", headers=docente["headers"]).json()
    assert [(r["name"], r["skills_count"]) for r in roles] == [("Propio", 2)]


def test_editar_cambia_el_nombre_y_reemplaza_las_skills(builder_client, docente, skill_ids):
    rol = _crear(builder_client, docente, "Antes", [skill_ids[0]["id"]]).json()
    r = builder_client.put(f"/custom-roles/{rol['id']}", headers=docente["headers"],
                           json={"name": "Después", "skill_ids": [str(skill_ids[1]["id"])]})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Después" and [s["code"] for s in r.json()["skills"]] == [skill_ids[1]["code"]]


def test_borrar_elimina_el_rol(builder_client, docente, skill_ids):
    rol = _crear(builder_client, docente, "Temporal", [skill_ids[0]["id"]]).json()
    assert builder_client.delete(f"/custom-roles/{rol['id']}", headers=docente["headers"]).status_code == 200
    assert builder_client.get(f"/custom-roles/{rol['id']}", headers=docente["headers"]).status_code == 404


def test_un_rol_ajeno_responde_404_en_ver_editar_y_borrar(builder_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    rol = _crear(builder_client, otro, "De otro", [skill_ids[0]["id"]]).json()
    url = f"/custom-roles/{rol['id']}"
    cuerpo = {"name": "x", "skill_ids": [str(skill_ids[0]["id"])]}
    assert builder_client.get(url, headers=docente["headers"]).status_code == 404
    assert builder_client.put(url, json=cuerpo, headers=docente["headers"]).status_code == 404
    assert builder_client.delete(url, headers=docente["headers"]).status_code == 404
    assert builder_client.get(url, headers=otro["headers"]).status_code == 200  # el rol sigue intacto


def test_validaciones_de_nombre_y_skills(builder_client, docente, skill_ids):
    ok = [skill_ids[0]["id"]]
    assert _crear(builder_client, docente, "   ", ok).status_code == 400
    assert _crear(builder_client, docente, "x" * 101, ok).status_code == 400
    assert _crear(builder_client, docente, "Sin skills", []).status_code == 400
    assert _crear(builder_client, docente, "Inexistente", [uuid.uuid4()]).status_code == 400
    assert _crear(builder_client, docente, "Repetido", ok).status_code == 201
    assert _crear(builder_client, docente, "repetido", ok).status_code == 400  # sin distinguir mayúsculas
    r = _crear(builder_client, docente, "Con repetidas", [ok[0], ok[0]])
    assert r.status_code == 201 and len(r.json()["skills"]) == 1  # las skills repetidas se ignoran


def test_un_validador_no_puede_usar_los_roles_propios(builder_client, validador, skill_ids):
    assert builder_client.get("/custom-roles", headers=validador["headers"]).status_code == 403
    assert _crear(builder_client, validador, "x", [skill_ids[0]["id"]]).status_code == 403
