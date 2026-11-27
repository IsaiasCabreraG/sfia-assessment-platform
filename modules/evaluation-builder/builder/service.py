"""Reglas de negocio del Constructor de Evaluaciones (Sprint 2)."""
from uuid import UUID

from shared.errors import BadRequest, NotFound
from shared.events import emit_event
from shared.security import AuthUser

from builder import repository

MAX_NAME = 100
MAX_SKILLS_PER_ROLE = 50


# ---------- Roles propios (HU-38) ----------


def _checked_role(cur, owner_id, name, skill_ids, role_id=None) -> tuple[str, list]:
    """Valida el nombre y las skills de un rol propio. Devuelve el nombre limpio y las skills sin repetir."""
    name = (name or "").strip()
    if not name or len(name) > MAX_NAME:
        raise BadRequest(f"El nombre es obligatorio y admite hasta {MAX_NAME} caracteres")
    ids = list(dict.fromkeys(skill_ids))
    if not 1 <= len(ids) <= MAX_SKILLS_PER_ROLE:
        raise BadRequest(f"Un rol debe tener entre 1 y {MAX_SKILLS_PER_ROLE} skills")
    if repository.count_existing_skills(cur, ids) != len(ids):
        raise BadRequest("Alguna de las skills no existe")
    if repository.role_name_taken(cur, owner_id, name, role_id):
        raise BadRequest("Ya tienes un rol con ese nombre")
    return name, ids


def _own_role(cur, user: AuthUser, role_id: UUID) -> dict:
    """Rol del usuario; uno ajeno responde igual que uno inexistente."""
    role = repository.get_role(cur, role_id)
    if role is None or role["owner_id"] != user.id:
        raise NotFound("Rol no encontrado")
    return role


def create_role(cur, user: AuthUser, name: str, skill_ids: list) -> dict:
    name, ids = _checked_role(cur, user.id, name, skill_ids)
    role = repository.insert_role(cur, user.id, name)
    repository.replace_role_skills(cur, role["id"], ids)
    return role_detail(cur, user, role["id"])


def list_roles(cur, user: AuthUser) -> list[dict]:
    return repository.list_roles(cur, user.id)


def role_detail(cur, user: AuthUser, role_id: UUID) -> dict:
    role = _own_role(cur, user, role_id)
    return {"id": role["id"], "name": role["name"], "created_at": role["created_at"],
            "skills": repository.get_role_skills(cur, role_id)}


def update_role(cur, user: AuthUser, role_id: UUID, name: str, skill_ids: list) -> dict:
    _own_role(cur, user, role_id)
    name, ids = _checked_role(cur, user.id, name, skill_ids, role_id)
    repository.rename_role(cur, role_id, name)
    repository.replace_role_skills(cur, role_id, ids)
    return role_detail(cur, user, role_id)


def delete_role(cur, user: AuthUser, role_id: UUID) -> dict:
    _own_role(cur, user, role_id)
    repository.delete_role(cur, role_id)
    return {"id": role_id}


# ---------- Evaluaciones: reglas, skills e ítems (HU-11) ----------

MAX_SKILLS_PER_DESIGN = 100
MAX_ITEMS_PER_DESIGN = 100
MAX_LEVEL = 7
ITEM_TYPES = {"single_choice", "true_false", "open_question", "coding", "system_design", "debugging"}


def _checked_name(name) -> str:
    name = (name or "").strip()
    if not name or len(name) > MAX_NAME:
        raise BadRequest(f"El nombre es obligatorio y admite hasta {MAX_NAME} caracteres")
    return name


def _checked_rules(cur, role_profile_id, duration_minutes) -> None:
    if role_profile_id is not None and repository.get_role_profile(cur, role_profile_id) is None:
        raise BadRequest("El rol SFIA no existe")
    if duration_minutes is not None and duration_minutes < 1:
        raise BadRequest("La duración debe ser de al menos 1 minuto")


def _checked_skills(cur, skills: list) -> list:
    """Valida las skills de una evaluación y devuelve [(skill_id, nivel mínimo, nivel máximo)] sin repetir.

    Cada skill lleva su propio rango de niveles; lo que no se indique es el rango en que SFIA define la skill.
    """
    por_skill = {}
    for s in skills:
        por_skill.setdefault(s["skill_id"], s)
    if len(por_skill) > MAX_SKILLS_PER_DESIGN:
        raise BadRequest(f"Una evaluación admite hasta {MAX_SKILLS_PER_DESIGN} skills")
    sfia = repository.get_skill_levels(cur, list(por_skill)) if por_skill else {}
    if len(sfia) != len(por_skill):
        raise BadRequest("Alguna de las skills no existe")
    resultado = []
    for skill_id, s in por_skill.items():
        lo = s.get("min_level") if s.get("min_level") is not None else sfia[skill_id][0]
        hi = s.get("max_level") if s.get("max_level") is not None else sfia[skill_id][1]
        if not (1 <= lo <= MAX_LEVEL and 1 <= hi <= MAX_LEVEL) or lo > hi:
            raise BadRequest(f"Los niveles de la skill deben estar entre 1 y {MAX_LEVEL} y el mínimo no puede superar al máximo")
        resultado.append((skill_id, lo, hi))
    return resultado


def _checked_items(cur, user: AuthUser, version_ids: list, current_ids: set, ranges: dict) -> list:
    """Valida las versiones de ítems del diseño y devuelve [(item_version_id, skill_id)] en orden.

    La skill de cada ítem sale del banco, nunca del cliente. El nivel del ítem debe estar en el rango de SU skill
    (skill_id -> (mínimo, máximo)). Los ítems nuevos deben estar activos, ser visibles para el docente y estar en su
    versión vigente; los que ya estaban se conservan fijados a su versión.
    """
    if len(version_ids) > MAX_ITEMS_PER_DESIGN:
        raise BadRequest(f"Una evaluación admite hasta {MAX_ITEMS_PER_DESIGN} ítems")
    if len(set(version_ids)) != len(version_ids):
        raise BadRequest("Hay un ítem repetido")
    rows = {r["item_version_id"]: r for r in repository.get_item_versions(cur, version_ids)}
    if len(rows) != len(version_ids):
        raise BadRequest("Alguno de los ítems no existe")
    result = []
    for version_id in version_ids:
        r = rows[version_id]
        if version_id not in current_ids:
            visible = r["available_to_experts"] or r["created_by"] == user.id
            if not visible or r["status"] != "active" or not r["is_current"]:
                raise BadRequest(f"El ítem de {r['skill_code']} no está disponible (inactivo, privado de otro docente "
                                 "o con una versión más nueva)")
        if r["skill_id"] not in ranges:
            raise BadRequest(f"El ítem de {r['skill_code']} necesita que la skill esté en la evaluación")
        lo, hi = ranges[r["skill_id"]]
        if not lo <= r["level"] <= hi:
            raise BadRequest(f"El ítem de {r['skill_code']} es de nivel {r['level']}, fuera del rango {lo} a {hi} "
                             "de esa skill en la evaluación")
        result.append((version_id, r["skill_id"]))
    return result


def _save_design(cur, user: AuthUser, design_id, rules: dict, skills: list, version_ids: list, current_ids: set) -> None:
    """Valida y guarda un diseño completo (reglas, skills con sus niveles e ítems). Lo usan las evaluaciones y las
    plantillas."""
    _checked_rules(cur, rules["role_profile_id"], rules["duration_minutes"])
    skills = _checked_skills(cur, skills)
    items = _checked_items(cur, user, version_ids, current_ids, {s: (lo, hi) for s, lo, hi in skills})
    repository.update_design(cur, design_id, rules["role_profile_id"], rules["duration_minutes"])
    repository.replace_design_content(cur, design_id, skills, items)


def _own_evaluation(cur, user: AuthUser, evaluation_id: UUID) -> dict:
    ev = repository.get_evaluation(cur, evaluation_id)
    if ev is None or ev["owner_id"] != user.id:
        raise NotFound("Evaluación no encontrada")
    return ev


def _role_customized(cur, role_profile_id, skills: list) -> bool:
    """«Rol personalizado»: hay un rol de base y las skills de la evaluación ya no son exactamente las del rol."""
    if role_profile_id is None:
        return False
    return {s["id"] for s in skills} != repository.profile_skill_ids(cur, role_profile_id)


def evaluation_detail(cur, user: AuthUser, evaluation_id: UUID) -> dict:
    ev = _own_evaluation(cur, user, evaluation_id)
    skills = repository.get_design_skills(cur, ev["design_id"])
    return {
        "id": ev["id"], "name": ev["name"], "status": ev["status"], "created_at": ev["created_at"],
        "published_at": ev["published_at"], "share_token": ev["share_token"],
        "role_profile": {"id": ev["role_profile_id"], "name": ev["role_profile_name"]} if ev["role_profile_id"] else None,
        "role_customized": _role_customized(cur, ev["role_profile_id"], skills),
        "duration_minutes": ev["duration_minutes"], "recommended_minutes": ev["recommended_minutes"],
        "skills": skills,
        "items": repository.get_design_items(cur, ev["design_id"], user.id),
    }


def _emit_composed(cur, evaluation_id, detail: dict) -> None:
    emit_event(cur, "EvaluationComposed", evaluation_id,
               {"evaluation_id": str(evaluation_id), "name": detail["name"], "status": detail["status"],
                "skills": [str(s["id"]) for s in detail["skills"]],
                "items": [str(i["item_version_id"]) for i in detail["items"]]})


def create_evaluation(cur, user: AuthUser, body: dict) -> dict:
    """Paso 1 del constructor: crea un borrador con sus reglas y sus skills con sus niveles (los ítems se eligen
    después)."""
    name = _checked_name(body.get("name"))
    rules = {k: body.get(k) for k in ("role_profile_id", "duration_minutes")}
    _checked_rules(cur, **rules)
    design = repository.insert_design(cur, None, None)
    ev = repository.insert_evaluation(cur, user.id, name, design["id"])
    _save_design(cur, user, design["id"], rules, body.get("skills") or [], [], set())
    detail = evaluation_detail(cur, user, ev["id"])
    _emit_composed(cur, ev["id"], detail)
    return detail


def _current_skills(cur, design_id) -> list:
    """Las skills del diseño, con sus niveles, en el formato con que se reciben."""
    return [{"skill_id": s["id"], "min_level": s["min_level"], "max_level": s["max_level"]}
            for s in repository.get_design_skills(cur, design_id)]


def update_evaluation(cur, user: AuthUser, evaluation_id: UUID, changes: dict) -> dict:
    """Modifica un borrador. Solo cambia lo que se envía: reglas, skills o ítems (en orden)."""
    ev = _own_evaluation(cur, user, evaluation_id)
    if ev["status"] != "draft":
        raise BadRequest("Solo se puede modificar una evaluación en borrador")
    name = _checked_name(changes["name"]) if "name" in changes else ev["name"]
    rules = {k: changes[k] if k in changes else ev[k] for k in ("role_profile_id", "duration_minutes")}
    actuales = repository.get_design_items(cur, ev["design_id"], user.id)
    skills = changes["skills"] if "skills" in changes else _current_skills(cur, ev["design_id"])
    version_ids = changes["item_version_ids"] if "item_version_ids" in changes else [i["item_version_id"] for i in actuales]
    _save_design(cur, user, ev["design_id"], rules, skills, version_ids, {i["item_version_id"] for i in actuales})
    if name != ev["name"]:
        repository.rename_evaluation(cur, evaluation_id, name)
    detail = evaluation_detail(cur, user, evaluation_id)
    _emit_composed(cur, evaluation_id, detail)
    return detail


def list_evaluations(cur, user: AuthUser, status: str | None) -> list[dict]:
    """Mis evaluaciones. Sin filtro no se muestran las descartadas; se piden con status=discarded."""
    if status not in (None, "draft", "published", "discarded"):
        raise BadRequest("status debe ser draft, published, discarded o vacío (todos)")
    return [{k: v for k, v in r.items() if k not in ("owner_id", "design_id", "role_profile_name")}
            for r in repository.list_evaluations(cur, user.id, status)]


def publish_evaluation(cur, user: AuthUser, evaluation_id: UUID) -> dict:
    """Publica un borrador (HU-12-3): tiene ítems y todos están activos y disponibles para su dueño. Si la duración
    está vacía, queda la recomendada (la suma de los minutos de los ítems). Desde entonces no se puede modificar.
    Todavía no genera un `share_token`: el link y las invitaciones son de las ejecuciones (ver sprint-2.md)."""
    ev = _own_evaluation(cur, user, evaluation_id)
    if ev["status"] != "draft":
        raise BadRequest("Solo se puede publicar una evaluación en borrador")
    items = repository.get_design_items(cur, ev["design_id"], user.id)
    if not items:
        raise BadRequest("La evaluación necesita al menos un ítem")
    bloqueo = [i for i in items if not i["item_active"] or not (i["item_public"] or i["is_mine"])]
    if bloqueo:
        raise BadRequest("Hay ítems inactivos o que ya no están disponibles: "
                         + ", ".join(sorted({i["skill_code"] for i in bloqueo})))
    if ev["duration_minutes"] is None:
        repository.set_design_duration(cur, ev["design_id"], ev["recommended_minutes"])
    repository.set_evaluation_status(cur, evaluation_id, "published")
    detail = evaluation_detail(cur, user, evaluation_id)
    _emit_composed(cur, evaluation_id, detail)
    return detail


def discard_evaluation(cur, user: AuthUser, evaluation_id: UUID) -> dict:
    """Descarta una evaluación (borrador o publicada): deja de aparecer entre las disponibles (HU-12-3).
    Pendiente de la Fase 4: impedirlo mientras tenga ejecuciones activas (HU-33)."""
    ev = _own_evaluation(cur, user, evaluation_id)
    if ev["status"] == "discarded":
        raise BadRequest("La evaluación ya está descartada")
    repository.set_evaluation_status(cur, evaluation_id, "discarded")
    detail = evaluation_detail(cur, user, evaluation_id)
    _emit_composed(cur, evaluation_id, detail)
    return detail


def duplicate_evaluation(cur, user: AuthUser, evaluation_id: UUID, name: str | None) -> dict:
    """Crea un borrador nuevo con una copia del diseño: es la forma de cambiar una evaluación ya publicada."""
    ev = _own_evaluation(cur, user, evaluation_id)
    nombre = _checked_name(name) if name else f"{ev['name']} (copia)"[:MAX_NAME]
    design = repository.copy_design(cur, ev["design_id"])
    nuevo = repository.insert_evaluation(cur, user.id, nombre, design["id"])
    detail = evaluation_detail(cur, user, nuevo["id"])
    _emit_composed(cur, nuevo["id"], detail)
    return detail


def item_usage(cur, user: AuthUser, item_id: UUID) -> dict:
    """Dónde se usa un ítem (cualquiera de sus versiones): solo cuentas, sin dueños. Sirve para avisar antes de
    desactivarlo o volverlo privado. Las evaluaciones publicadas no cambian, porque apuntan a versiones fijas."""
    item = repository.get_item_for_usage(cur, item_id)
    if item is None or not (item["available_to_experts"] or item["created_by"] == user.id):
        raise NotFound("Ítem no encontrado")
    return {"item_id": item_id, **repository.item_usage(cur, item_id)}


def available_items(cur, user: AuthUser, *, skill_ids, min_level, max_level, item_type, q, evaluation_id,
                    only_rules: bool, limit: int, offset: int, order: str = "skill") -> dict:
    """Ítems del banco que el docente puede agregar (activos, públicos o suyos, en su versión vigente).

    Los filtros son libres. Con `evaluation_id`, cada ítem indica si su skill está en la evaluación, si su nivel está
    en el rango de esa skill y si el ítem ya fue agregado, para que el portal pida confirmación antes de sumar una
    skill nueva o ampliar su rango. Con `only_rules` solo se ofrecen los ítems que cumplen las reglas.
    """
    if item_type is not None and item_type not in ITEM_TYPES:
        raise BadRequest(f"Tipo de ítem inválido: {item_type}")
    if order not in repository.AVAILABLE_ORDERS:
        raise BadRequest(f"order debe ser uno de: {', '.join(repository.AVAILABLE_ORDERS)}")
    design_id, design_items = None, []
    if evaluation_id is not None:
        design_id = _own_evaluation(cur, user, evaluation_id)["design_id"]
        design_items = repository.design_item_ids(cur, design_id)
    elif only_rules:
        raise BadRequest("only_rules necesita una evaluación (evaluation_id)")
    rows = repository.list_available_items(cur, {
        "user_id": user.id, "skill_ids": skill_ids or None, "min_level": min_level, "max_level": max_level,
        "item_type": item_type, "q": (q or "").strip() or None, "design_id": design_id,
        "only_rules": only_rules, "design_items": design_items, "order": order, "limit": min(max(limit, 1), 100), "offset": max(offset, 0)})
    total = rows[0]["total"] if rows else 0
    return {"total": total, "items": [{k: v for k, v in r.items() if k != "total"} for r in rows]}


# ---------- Plantillas (HU-12) ----------

VISIBILITIES = ("private", "public")


def _checked_visibility(visibility) -> str:
    if visibility not in VISIBILITIES:
        raise BadRequest("La visibilidad debe ser private o public")
    return visibility


def _blockers(items: list[dict], *, public: bool) -> list[dict]:
    """Ítems que impiden usar una plantilla: inactivos o, en una plantilla pública, no públicos.

    En una plantilla privada basta con que el ítem esté activo y lo pueda ver quien la usa: sus ítems o los públicos.
    """
    return [i for i in items if not i["item_active"] or not (i["item_public"] or (not public and i["is_mine"]))]


def _blocked_view(items: list[dict]) -> list[dict]:
    return [{"skill_code": i["skill_code"], "item_id": i["item_id"],
             "reason": "inactivo" if not i["item_active"] else "no público"} for i in items]


def _template_view(cur, user: AuthUser, t: dict) -> dict:
    """Datos de una plantilla con su disponibilidad, que se calcula cada vez (limitación: ver sprint-2.md)."""
    items = repository.get_design_items(cur, t["design_id"], t["owner_id"])  # quien la creó es el referente de «mío»
    public = t["visibility"] == "public"
    bloqueo = _blockers(items, public=public)
    mine = t["owner_id"] == user.id
    return {"id": t["id"], "name": t["name"], "visibility": t["visibility"], "mine": mine, "owner_name": t["owner_name"],
            "available": not bloqueo, "blocked_items": _blocked_view(bloqueo) if mine else None,
            "role_profile": {"id": t["role_profile_id"], "name": t["role_profile_name"]} if t["role_profile_id"] else None,
            "duration_minutes": t["duration_minutes"], "skills_count": t["skills_count"], "items_count": t["items_count"],
            "created_at": t["created_at"], "updated_at": t["updated_at"]}, items


def _readable_template(cur, user: AuthUser, template_id: UUID) -> dict:
    """Plantilla propia, o pública y disponible de otro docente; si no, responde como inexistente."""
    t = repository.get_template(cur, template_id)
    if t is None:
        raise NotFound("Plantilla no encontrada")
    if t["owner_id"] != user.id:
        vista, _ = _template_view(cur, user, t)
        if t["visibility"] != "public" or not vista["available"]:
            raise NotFound("Plantilla no encontrada")
    return t


def _own_template(cur, user: AuthUser, template_id: UUID) -> dict:
    t = repository.get_template(cur, template_id)
    if t is None or t["owner_id"] != user.id:
        raise NotFound("Plantilla no encontrada")
    return t


def _check_public(cur, user: AuthUser, design_id, make_items_public: bool) -> None:
    """Una plantilla pública solo puede tener ítems públicos. Los ítems propios privados se hacen públicos solo si se
    confirma; los de otros docentes no se pueden publicar, y los inactivos tampoco."""
    items = repository.get_design_items(cur, design_id, user.id)
    inactivos = [i for i in items if not i["item_active"]]
    ajenos = [i for i in items if not i["item_public"] and not i["is_mine"]]
    propios = [i for i in items if not i["item_public"] and i["is_mine"]]
    if inactivos:
        raise BadRequest("Hay ítems inactivos: " + ", ".join(sorted({i["skill_code"] for i in inactivos})))
    if ajenos:
        raise BadRequest("Hay ítems privados de otros docentes que no se pueden publicar: "
                         + ", ".join(sorted({i["skill_code"] for i in ajenos})))
    if propios and not make_items_public:
        raise BadRequest(f"{len(propios)} ítem(s) tuyos son privados: confirma hacerlos públicos o deja la plantilla privada")
    if propios:
        repository.publish_items(cur, [i["item_id"] for i in propios])


def _template_detail(cur, user: AuthUser, t: dict) -> dict:
    vista, items = _template_view(cur, user, t)
    vista["skills"] = repository.get_design_skills(cur, t["design_id"])
    vista["role_customized"] = _role_customized(cur, t["role_profile_id"], vista["skills"])
    vista["items"] = repository.get_design_items(cur, t["design_id"], user.id)
    return vista


def save_as_template(cur, user: AuthUser, evaluation_id: UUID, name: str, visibility: str, make_items_public: bool) -> dict:
    """Guarda una copia del diseño de la evaluación como plantilla; la evaluación sigue su camino (HU-12)."""
    ev = _own_evaluation(cur, user, evaluation_id)
    name, visibility = _checked_name(name), _checked_visibility(visibility)
    design = repository.copy_design(cur, ev["design_id"])
    if visibility == "public":
        _check_public(cur, user, design["id"], make_items_public)
    t = repository.insert_template(cur, user.id, name, visibility, design["id"])
    if visibility == "public":
        emit_event(cur, "TemplatePublished", t["id"], {"template_id": str(t["id"]), "name": name})
    return _template_detail(cur, user, repository.get_template(cur, t["id"]))


def list_templates(cur, user: AuthUser) -> list[dict]:
    """Mis plantillas y las públicas de otros que estén disponibles."""
    vistas = []
    for t in repository.list_templates(cur, user.id):
        vista, _ = _template_view(cur, user, t)
        if vista["mine"] or vista["available"]:
            vistas.append(vista)
    return vistas


def template_detail(cur, user: AuthUser, template_id: UUID) -> dict:
    return _template_detail(cur, user, _readable_template(cur, user, template_id))


def update_template(cur, user: AuthUser, template_id: UUID, changes: dict) -> dict:
    """Modifica una plantilla propia: nombre, visibilidad y diseño (como en una evaluación)."""
    t = _own_template(cur, user, template_id)
    name = _checked_name(changes["name"]) if "name" in changes else t["name"]
    visibility = _checked_visibility(changes["visibility"]) if "visibility" in changes else t["visibility"]
    rules = {k: changes[k] if k in changes else t[k] for k in ("role_profile_id", "duration_minutes")}
    actuales = repository.get_design_items(cur, t["design_id"], user.id)
    skills = changes["skills"] if "skills" in changes else _current_skills(cur, t["design_id"])
    version_ids = changes["item_version_ids"] if "item_version_ids" in changes else [i["item_version_id"] for i in actuales]
    _save_design(cur, user, t["design_id"], rules, skills, version_ids, {i["item_version_id"] for i in actuales})
    if visibility == "public":
        _check_public(cur, user, t["design_id"], bool(changes.get("make_items_public")))
        if t["visibility"] != "public":
            emit_event(cur, "TemplatePublished", template_id, {"template_id": str(template_id), "name": name})
    repository.update_template(cur, template_id, name, visibility)
    return _template_detail(cur, user, repository.get_template(cur, template_id))


def use_template(cur, user: AuthUser, template_id: UUID, name: str | None) -> dict:
    """Crea un borrador copiando el diseño de una plantilla propia o pública. Todos sus ítems deben estar activos y
    disponibles para quien la usa; si no, no se puede usar y se indica cuáles."""
    t = _readable_template(cur, user, template_id)
    items = repository.get_design_items(cur, t["design_id"], user.id)
    bloqueo = [i for i in items if not i["item_active"] or not (i["item_public"] or i["is_mine"])]
    if bloqueo:
        raise BadRequest("La plantilla no se puede usar: hay ítems inactivos o no públicos ("
                         + ", ".join(sorted({i["skill_code"] for i in bloqueo})) + ")")
    nombre = _checked_name(name) if name else t["name"]
    design = repository.copy_design(cur, t["design_id"])
    ev = repository.insert_evaluation(cur, user.id, nombre, design["id"])
    detail = evaluation_detail(cur, user, ev["id"])
    _emit_composed(cur, ev["id"], detail)
    return detail


def delete_template(cur, user: AuthUser, template_id: UUID) -> dict:
    t = _own_template(cur, user, template_id)
    repository.delete_template(cur, template_id, t["design_id"])
    return {"id": template_id}
