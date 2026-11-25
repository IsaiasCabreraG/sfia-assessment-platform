"""HU-11: armar una evaluación (reglas, skills e ítems) y buscar ítems del banco para agregar."""
import copy
import uuid

import pytest

from shared.db import connect
from tests.conftest import make_user
from tests.helpers import publicar
from tests.samples import SAMPLES


def _s(x):
    return str(x)


def _sk(skill, lo=None, hi=None):
    """Una skill de la evaluación, con sus niveles si se indican (si no, los que SFIA define para ella)."""
    d = {"skill_id": _s(skill)}
    if lo is not None:
        d["min_level"] = lo
    if hi is not None:
        d["max_level"] = hi
    return d


def _item(content_client, user, skill_id, texto=None, level=3, disponible=True):
    """Publica un ítem de alternativa única (sin IA) y devuelve (item_id, item_version_id)."""
    contenido = copy.deepcopy(SAMPLES["single_choice"])
    contenido["statement"] = texto or f"Ítem {uuid.uuid4().hex[:8]}"
    r = publicar(content_client, user, skill_id, "single_choice", [contenido], level=level, disponible=disponible)
    assert r.status_code == 201, r.text
    return r.json()["items"][0]["id"], r.json()["items"][0]["version_id"]


def _crear(builder_client, user, **campos):
    return builder_client.post("/evaluations", headers=user["headers"], json={"name": "Prueba", **campos})


def _borrador(builder_client, user, skills, **campos):
    """Borrador con esas skills: ids (con todos los niveles, 1 a 7, para no depender del rango de SFIA) o diccionarios."""
    lista = [s if isinstance(s, dict) else _sk(s, 1, 7) for s in skills]
    r = _crear(builder_client, user, skills=lista, **campos)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _put(builder_client, user, evaluation_id, **cambios):
    return builder_client.put(f"/evaluations/{evaluation_id}", headers=user["headers"], json=cambios)


def _items(detalle):
    return [i["item_version_id"] for i in detalle["items"]]


def _rangos(detalle):
    return {s["id"]: (s["min_level"], s["max_level"]) for s in detalle["skills"]}


@pytest.fixture(scope="session")
def rol():
    """Un rol SFIA con todas sus skills y una skill que no pertenece a él."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT p.id FROM catalog.role_profiles p "
            "WHERE (SELECT count(*) FROM catalog.role_profile_skills WHERE profile_id = p.id) BETWEEN 2 AND 40 "
            "ORDER BY p.name LIMIT 1")
        perfil = cur.fetchone()["id"]
        cur.execute("SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = %s", (perfil,))
        todas = [r["skill_id"] for r in cur.fetchall()]
        cur.execute("SELECT id FROM catalog.skills WHERE id NOT IN "
                    "(SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = %s) LIMIT 1", (perfil,))
        fuera = cur.fetchone()["id"]
    return {"id": perfil, "todas": todas, "fuera": fuera}


# ---------- Reglas y skills con sus niveles (paso 1) ----------

def test_cada_skill_lleva_sus_niveles_y_se_edita_por_partes(builder_client, docente, skill_ids):
    a, b = skill_ids[0]["id"], skill_ids[1]["id"]
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT min_level, max_level FROM catalog.skills WHERE id = %s", (a,))
        sfia = cur.fetchone()
    r = _crear(builder_client, docente, duration_minutes=60, skills=[_sk(a), _sk(b, 3, 4)])
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["status"] == "draft" and d["duration_minutes"] == 60 and d["role_customized"] is False
    assert _rangos(d) == {_s(a): (sfia["min_level"], sfia["max_level"]), _s(b): (3, 4)}  # por defecto, los de SFIA
    assert {s["id"]: s["sfia_min_level"] for s in d["skills"]}[_s(a)] == sfia["min_level"]
    ev = d["id"]
    r = _put(builder_client, docente, ev, name="Otro nombre")  # solo cambia lo que se envía
    assert r.json()["name"] == "Otro nombre" and _rangos(r.json()) == _rangos(d)
    r = _put(builder_client, docente, ev, skills=[_sk(b, 2, 5)])
    assert _rangos(r.json()) == {_s(b): (2, 5)} and r.json()["name"] == "Otro nombre"
    r = _put(builder_client, docente, ev, duration_minutes=None)  # enviar null borra el valor
    assert r.json()["duration_minutes"] is None and _rangos(r.json()) == {_s(b): (2, 5)}


def test_el_rol_pasa_a_ser_personalizado_al_cambiar_sus_skills(builder_client, docente, rol):
    ev = _borrador(builder_client, docente, rol["todas"], role_profile_id=_s(rol["id"]))
    detalle = lambda: builder_client.get(f"/evaluations/{ev}", headers=docente["headers"]).json()
    assert detalle()["role_customized"] is False and detalle()["role_profile"]["id"] == _s(rol["id"])
    d = _put(builder_client, docente, ev, skills=[_sk(s, 1, 7) for s in rol["todas"] + [rol["fuera"]]]).json()
    assert d["role_customized"] is True  # se añadió una skill que no es del rol
    d = _put(builder_client, docente, ev, skills=[_sk(s, 1, 7) for s in rol["todas"]]).json()
    assert d["role_customized"] is False
    assert _put(builder_client, docente, ev, role_profile_id=None).json()["role_customized"] is False


def test_validaciones_de_las_reglas(builder_client, docente, skill_ids):
    ok = _s(skill_ids[0]["id"])
    for malo in ({"name": "  "}, {"name": "x" * 101}, {"role_profile_id": _s(uuid.uuid4())}, {"duration_minutes": 0},
                 {"skills": [{"skill_id": ok, "min_level": 5, "max_level": 3}]},
                 {"skills": [{"skill_id": ok, "min_level": 0, "max_level": 3}]},
                 {"skills": [{"skill_id": ok, "min_level": 3, "max_level": 8}]},
                 {"skills": [{"skill_id": _s(uuid.uuid4())}]}):
        cuerpo = {"name": "Prueba", "skills": [_sk(ok)], **malo}
        assert builder_client.post("/evaluations", headers=docente["headers"], json=cuerpo).status_code == 400, malo


# ---------- Ítems (paso 2) ----------

def test_agregar_items_en_orden_y_duracion_recomendada(builder_client, content_client, docente, skill_ids):
    a = _item(content_client, docente, skill_ids[0]["id"])
    b = _item(content_client, docente, skill_ids[0]["id"])
    ev = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    d = _put(builder_client, docente, ev, item_version_ids=[_s(b[1]), _s(a[1])]).json()
    assert _items(d) == [_s(b[1]), _s(a[1])] and [i["position"] for i in d["items"]] == [1, 2]
    assert d["recommended_minutes"] == 20 and d["duration_minutes"] is None
    d = _put(builder_client, docente, ev, item_version_ids=[_s(a[1]), _s(b[1])], duration_minutes=15).json()
    assert _items(d) == [_s(a[1]), _s(b[1])] and d["duration_minutes"] == 15 and d["recommended_minutes"] == 20


def test_un_item_de_una_skill_nueva_se_acepta_al_agregar_la_skill_en_la_misma_peticion(
        builder_client, content_client, docente, skill_ids):
    a, b = skill_ids[0]["id"], skill_ids[1]["id"]
    nuevo = _item(content_client, docente, b)
    ev = _borrador(builder_client, docente, [a])
    r = _put(builder_client, docente, ev, item_version_ids=[_s(nuevo[1])])
    assert r.status_code == 400 and skill_ids[1]["code"] in r.json()["detail"]
    r = _put(builder_client, docente, ev, item_version_ids=[_s(nuevo[1])],
             skills=[_sk(a, 1, 7), _sk(b, 1, 7)])  # lo que envía el portal tras confirmar
    assert r.status_code == 200 and _items(r.json()) == [_s(nuevo[1])]
    # quitar una skill con ítems exige quitar también los ítems
    assert _put(builder_client, docente, ev, skills=[_sk(a, 1, 7)]).status_code == 400
    r = _put(builder_client, docente, ev, skills=[_sk(a, 1, 7)], item_version_ids=[])
    assert r.status_code == 200 and r.json()["items"] == []


def test_el_rango_de_niveles_es_de_cada_skill(builder_client, content_client, docente, skill_ids):
    a, b = skill_ids[0]["id"], skill_ids[1]["id"]
    de_a = _item(content_client, docente, a, level=6)
    de_b = _item(content_client, docente, b, level=6)
    ev = _borrador(builder_client, docente, [_sk(a, 3, 4), _sk(b, 5, 7)])
    r = _put(builder_client, docente, ev, item_version_ids=[_s(de_a[1])])
    assert r.status_code == 400 and "fuera del rango 3 a 4" in r.json()["detail"]
    r = _put(builder_client, docente, ev, item_version_ids=[_s(de_b[1])])  # el nivel 6 está en el rango 5–7 de la otra skill
    assert r.status_code == 200
    r = _put(builder_client, docente, ev, item_version_ids=[_s(de_a[1]), _s(de_b[1])], skills=[_sk(a, 3, 6), _sk(b, 5, 7)])
    assert r.status_code == 200 and _rangos(r.json())[_s(a)] == (3, 6)  # lo que envía el portal tras confirmar
    assert _put(builder_client, docente, ev, skills=[_sk(a, 3, 4), _sk(b, 5, 7)]).status_code == 400  # estrechar deja el ítem fuera


def test_items_no_disponibles(builder_client, content_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    privado_ajeno = _item(content_client, otro, skill_ids[0]["id"], disponible=False)
    publico_ajeno = _item(content_client, otro, skill_ids[0]["id"], disponible=True)
    propio_privado = _item(content_client, docente, skill_ids[0]["id"], disponible=False)
    inactivo = _item(content_client, docente, skill_ids[0]["id"])
    content_client.patch(f"/items/{inactivo[0]}/status", json={"status": "inactive"}, headers=docente["headers"])
    ev = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    for malo in (privado_ajeno, inactivo):
        assert _put(builder_client, docente, ev, item_version_ids=[_s(malo[1])]).status_code == 400
    r = _put(builder_client, docente, ev, item_version_ids=[_s(publico_ajeno[1]), _s(propio_privado[1])])
    assert r.status_code == 200 and len(r.json()["items"]) == 2  # público ajeno y privado propio sí


def test_versiones_de_un_item_repetida_o_inexistente_no_y_dos_versiones_si_y_cada_una_queda_fijada(
        builder_client, content_client, docente, skill_ids):
    item = _item(content_client, docente, skill_ids[0]["id"])
    ev = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    assert _put(builder_client, docente, ev, item_version_ids=[_s(item[1]), _s(item[1])]).status_code == 400
    assert _put(builder_client, docente, ev, item_version_ids=[_s(uuid.uuid4())]).status_code == 400
    assert _put(builder_client, docente, ev, item_version_ids=[_s(item[1])]).status_code == 200
    nueva = content_client.put(f"/items/{item[0]}", headers=docente["headers"], json={
        "item": SAMPLES["single_choice"], "estimated_minutes": 10, "available_to_experts": True}).json()
    d = _put(builder_client, docente, ev, name="Sigue válida").json()  # la v1 fijada no se revalida como "vigente"
    assert _items(d) == [_s(item[1])] and d["items"][0]["version"] == 1
    r = _put(builder_client, docente, ev, item_version_ids=[_s(item[1]), _s(nueva["version_id"])])  # v1 y v2 juntas
    assert r.status_code == 200 and [i["version"] for i in r.json()["items"]] == [1, 2]
    otra = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    assert _put(builder_client, docente, otra, item_version_ids=[_s(item[1])]).status_code == 400  # la v1 ya no es la vigente


# ---------- Propiedad, estado y listado ----------

def test_una_evaluacion_es_de_su_dueno_solo_se_modifica_en_borrador_y_se_lista_con_filtro(
        builder_client, docente, validador, skill_ids):
    otro = make_user(["teacher_recruiter"])
    ajena = _borrador(builder_client, otro, [skill_ids[0]["id"]])
    assert builder_client.get(f"/evaluations/{ajena}", headers=docente["headers"]).status_code == 404
    assert _put(builder_client, docente, ajena, name="x").status_code == 404
    assert builder_client.get("/evaluations", headers=validador["headers"]).status_code == 403
    propia = _borrador(builder_client, docente, [skill_ids[0]["id"]])
    lista = builder_client.get("/evaluations", headers=docente["headers"]).json()
    assert [e["id"] for e in lista] == [propia] and lista[0]["skills_count"] == 1 and lista[0]["items_count"] == 0
    assert builder_client.get("/evaluations?status=published", headers=docente["headers"]).json() == []
    assert builder_client.get("/evaluations?status=otro", headers=docente["headers"]).status_code == 400
    with connect() as conn, conn.cursor() as cur:
        cur.execute("UPDATE evaluation.evaluations SET status = 'published' WHERE id = %s", (propia,))
    assert _put(builder_client, docente, propia, name="x").status_code == 400


# ---------- Ítems disponibles ----------

def test_items_disponibles_filtros_visibilidad_y_marcas_de_la_evaluacion(builder_client, content_client, docente, skill_ids):
    otro = make_user(["teacher_recruiter"])
    marca = uuid.uuid4().hex[:8]
    a, b = skill_ids[0]["id"], skill_ids[1]["id"]
    en_rango = _item(content_client, otro, a, f"{marca} en rango", level=3)
    _item(content_client, otro, a, f"{marca} privado ajeno", level=3, disponible=False)
    fuera = _item(content_client, docente, a, f"{marca} fuera de rango", level=5, disponible=False)
    de_otra = _item(content_client, otro, b, f"{marca} otra skill", level=3)

    def buscar(**filtros):
        r = builder_client.get("/available-items", headers=docente["headers"], params={"q": marca, **filtros})
        assert r.status_code == 200, r.text
        return r.json()["items"]

    ids = lambda items: {i["id"] for i in items}
    assert ids(buscar()) == {en_rango[0], fuera[0], de_otra[0]}  # sin el privado de otro docente
    assert ids(buscar(skill_ids=[_s(b)])) == {de_otra[0]}
    assert ids(buscar(min_level=4)) == {fuera[0]} and ids(buscar(max_level=3)) == {en_rango[0], de_otra[0]}
    assert ids(buscar(item_type="coding")) == set()
    assert builder_client.get("/available-items", headers=docente["headers"], params={"item_type": "x"}).status_code == 400
    ev = _borrador(builder_client, docente, [_sk(a, 3, 4)])
    _put(builder_client, docente, ev, item_version_ids=[_s(en_rango[1])])
    por_id = {i["id"]: i for i in buscar(evaluation_id=ev)}
    marcas = lambda i: (por_id[i[0]]["skill_in_evaluation"], por_id[i[0]]["level_in_range"], por_id[i[0]]["already_added"])
    assert marcas(en_rango) == (True, True, True) and marcas(fuera) == (True, False, False)
    assert marcas(de_otra) == (False, None, False)  # la skill no está en la evaluación
    assert ids(buscar(evaluation_id=ev, only_rules=True)) == {en_rango[0]}  # solo lo que cumple las reglas
    assert builder_client.get("/available-items", headers=docente["headers"], params={"only_rules": True}).status_code == 400
    assert builder_client.get("/available-items", headers=otro["headers"], params={"evaluation_id": ev}).status_code == 404
