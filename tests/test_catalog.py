"""HU-02: catálogo SFIA (skills, niveles 1 a 7 y perfiles de rol)."""


def test_skills_con_filtros(catalog_client, docente):
    h = docente["headers"]
    todas = catalog_client.get("/skills", headers=h).json()
    assert len(todas) >= 100 and {"id", "code", "name", "category"} <= todas[0].keys()
    por_texto = catalog_client.get("/skills", params={"q": "prog"}, headers=h).json()
    assert por_texto and all("prog" in (s["code"] + s["name"]).lower() for s in por_texto)
    categoria = catalog_client.get("/skills/categories", headers=h).json()[0]
    assert all(s["category"] == categoria
               for s in catalog_client.get("/skills", params={"category": categoria}, headers=h).json())


def test_detalle_de_skill(catalog_client, docente):
    skill = catalog_client.get("/skills", headers=docente["headers"]).json()[0]
    detalle = catalog_client.get(f"/skills/{skill['id']}", headers=docente["headers"]).json()
    assert detalle["code"] == skill["code"] and detalle["description"]
    assert catalog_client.get("/skills/00000000-0000-0000-0000-000000000000", headers=docente["headers"]).status_code == 404


def test_siete_niveles(catalog_client, validador):
    niveles = catalog_client.get("/levels", headers=validador["headers"]).json()
    assert [n["level"] for n in niveles] == [1, 2, 3, 4, 5, 6, 7]


def test_perfiles_de_rol_con_sus_skills(catalog_client, docente):
    perfiles = catalog_client.get("/role-profiles", headers=docente["headers"]).json()
    assert len(perfiles) >= 50
    detalle = catalog_client.get(f"/role-profiles/{perfiles[0]['id']}", headers=docente["headers"]).json()
    assert detalle["skills"] and {"code", "min_level", "is_primary"} <= detalle["skills"][0].keys()
    assert len(detalle["skills"]) == perfiles[0]["skills_count"]


def test_cada_skill_trae_su_nivel_minimo_y_maximo(catalog_client, docente):
    skills = catalog_client.get("/skills", headers=docente["headers"]).json()
    assert all(1 <= s["min_level"] <= s["max_level"] <= 7 for s in skills)
    detalle = catalog_client.get(f"/skills/{skills[0]['id']}", headers=docente["headers"]).json()
    assert (detalle["min_level"], detalle["max_level"]) == (skills[0]["min_level"], skills[0]["max_level"])


def test_el_perfil_de_rol_toma_el_nivel_de_la_skill(catalog_client, docente):
    perfiles = catalog_client.get("/role-profiles", headers=docente["headers"]).json()
    skills = {s["id"]: s for s in catalog_client.get("/skills", headers=docente["headers"]).json()}
    for s in catalog_client.get(f"/role-profiles/{perfiles[0]['id']}", headers=docente["headers"]).json()["skills"]:
        assert (s["min_level"], s["max_level"]) == (skills[s["id"]]["min_level"], skills[s["id"]]["max_level"])
