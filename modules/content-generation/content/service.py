"""Reglas de negocio de content: generar ítems con IA, listar con filtros, ver, activar/desactivar y puntuar."""
from decimal import Decimal
from uuid import UUID

from shared.errors import BadGateway, BadRequest, NotFound
from shared.events import emit_event
from shared.security import AuthUser

from content import repository
from content.generation.llm_client import ask_llm
from content.generation.parser import extract_json
from content.generation.prompts import build_prompt
from content.generation.schemas import validate_items
from content.types import ITEM_TYPES, MAX_ITEMS_PER_REQUEST, OPEN_TYPES

MAX_ATTEMPTS = 2  # un intento más si la IA devuelve un JSON inválido o que no cumple las reglas


# ---------- Borradores (HU-04 y HU-06) ----------


def generate_drafts(cur, authorization: str, *, skill_id: UUID, level: int, item_type: str, item_count: int,
                    estimated_minutes: int, context: str | None, feedback: str | None = None,
                    previous_statement: str | None = None) -> dict:
    """Pide a la IA `item_count` borradores de la skill/nivel/tipo indicados. NO guarda nada.

    Flujo: valida el pedido → arma el prompt → llama al módulo llm → valida la respuesta (reintenta
    una vez). El usuario revisa y edita los borradores en el portal y recién los guarda `publish_items`.
    Se usa también para regenerar un borrador (`item_count` = 1, con `feedback`).
    """
    skill, level_title = _check_request(cur, skill_id, level, item_type, estimated_minutes)
    if not 1 <= item_count <= MAX_ITEMS_PER_REQUEST:
        raise BadRequest(f"La cantidad de ítems debe estar entre 1 y {MAX_ITEMS_PER_REQUEST}")
    context = (context or "").strip() or None
    contents, error = _ask_for_items(
        authorization, skill=skill, level=level, level_title=level_title, item_type=item_type,
        count=item_count, minutes=estimated_minutes, context=context,
        feedback=(feedback or "").strip() or None, previous_statement=previous_statement)
    if not contents:
        raise BadGateway(error)
    return {"skill_id": skill_id, "level": level, "item_type": item_type,
            "estimated_minutes": estimated_minutes, "drafts": [c.model_dump() for c in contents]}


def _check_request(cur, skill_id, level, item_type, estimated_minutes):
    """Valida skill, nivel, tipo y tiempo. Devuelve (skill, título del nivel)."""
    skill = repository.get_skill(cur, skill_id)
    if skill is None:
        raise NotFound("Skill no encontrada")
    if not (skill.get("description") or "").strip():
        raise BadRequest(f"La skill {skill['code']} no tiene descripción en el catálogo; el prompt la necesita")
    level_title = repository.get_level_title(cur, level)
    if level_title is None:
        raise BadRequest("El nivel de responsabilidad debe estar entre 1 y 7")
    if item_type not in ITEM_TYPES:
        raise BadRequest(f"Tipo de ítem inválido: {item_type}")
    if estimated_minutes <= 0:
        raise BadRequest("El tiempo estimado debe ser mayor que 0")
    return skill, level_title


def _ask_for_items(authorization: str, *, skill, level, level_title, item_type, count, minutes, context,
                   feedback=None, previous_statement=None):
    """Llama a la IA hasta MAX_ATTEMPTS veces. Devuelve (contenidos válidos, None) o ([], mensaje de error)."""
    previous_error = None
    for _ in range(MAX_ATTEMPTS):
        prompt = build_prompt(skill=skill, level=level, level_title=level_title, item_type=item_type,
                              count=count, estimated_minutes=minutes, context=context,
                              previous_error=previous_error, feedback=feedback,
                              previous_statement=previous_statement)
        try:
            raw_items = extract_json(ask_llm(prompt, authorization))["items"]
            if len(raw_items) != count:
                raise ValueError(f"se pidieron {count} ítems y llegaron {len(raw_items)}")
            return validate_items(item_type, raw_items), None
        except ValueError as e:
            previous_error = str(e)
        except BadGateway as e:
            return [], e.mensaje  # el módulo llm no responde: reintentar no ayuda
    return [], f"La IA no devolvió ítems válidos: {previous_error}"


# ---------- Publicación ----------

MAX_GROUPS = 50
MAX_ITEMS_PER_GROUP = 50


def publish_items(cur, user: AuthUser, *, available_to_experts: bool, groups: list[dict]) -> dict:
    """Guarda en el banco los borradores revisados por el autor: versión 1, activos y sin puntuar.

    Cada grupo es (skill, nivel, tipo, tiempo, contexto) con sus ítems ya editados. Todo se valida
    antes de guardar (las ediciones del usuario deben cumplir las mismas reglas que lo generado por la IA);
    si algo falla no se guarda nada. `available_to_experts` = false deja los ítems de uso privado.
    """
    if not 1 <= len(groups) <= MAX_GROUPS:
        raise BadRequest(f"Debe haber entre 1 y {MAX_GROUPS} grupos de ítems")
    validated = []
    for g in groups:
        _check_request(cur, g["skill_id"], g["level"], g["item_type"], g["estimated_minutes"])
        if not 1 <= len(g["items"]) <= MAX_ITEMS_PER_GROUP:
            raise BadRequest(f"Cada grupo debe tener entre 1 y {MAX_ITEMS_PER_GROUP} ítems")
        try:
            contents = validate_items(g["item_type"], g["items"])
        except ValueError as e:
            raise BadRequest(f"{g['item_type']}: {e}")
        validated.append((g, contents))

    items = []
    for g, contents in validated:
        request = repository.insert_generation_request(
            cur, user.id, g["skill_id"], g["level"], g["item_type"], len(contents), g["estimated_minutes"],
            (g.get("context") or "").strip() or None, "completed")
        for c in contents:
            item = repository.insert_item(cur, g["skill_id"], user.id, available_to_experts)
            version = repository.insert_version(
                cur, item_id=item["id"], version=1, type=g["item_type"], origin="generated",
                request_id=request["id"], level=g["level"], minutes=g["estimated_minutes"],
                goal=c.evaluation_goal, statement=c.statement)
            repository.insert_content(cur, version["id"], g["item_type"], c)
            emit_event(cur, "ItemVersionCreated", item["id"],
                       {"item_id": str(item["id"]), "version": 1, "type": g["item_type"], "origin": "generated"})
            items.append({"id": item["id"], "version_id": version["id"], "status": item["status"],
                          "available_to_experts": available_to_experts})
    return {"items": items}


# ---------- Consulta ----------


def list_items(cur, user: AuthUser, *, status: str | None, skill_id, profile_id, item_type, level, scored,
               min_score, max_score, limit: int, offset: int) -> dict:
    """Lista ítems con filtros (HU-07).

    Quien no es docente/reclutador solo ve los activos que el autor dejó disponibles para expertos;
    el docente/reclutador ve además los suyos de uso privado.
    """
    es_docente = "teacher_recruiter" in user.roles
    if not es_docente:
        status = "active"
    if status not in (None, "active", "inactive"):
        raise BadRequest("status debe ser active, inactive o vacío (todos)")
    if scored not in (None, "scored", "unscored"):
        raise BadRequest("scored debe ser scored, unscored o vacío (todos)")
    if item_type is not None and item_type not in ITEM_TYPES:
        raise BadRequest(f"Tipo de ítem inválido: {item_type}")
    for nombre, valor in (("min_score", min_score), ("max_score", max_score)):
        if valor is not None and not Decimal(0) <= valor <= Decimal(5):
            raise BadRequest(f"{nombre} debe estar entre 0.0 y 5.0")
    rows = repository.list_items(cur, {
        "only_available": not es_docente, "user_id": user.id, "status": status, "skill_id": skill_id, "profile_id": profile_id, "item_type": item_type,
        "level": level, "scored": scored, "min_score": min_score, "max_score": max_score,
        "limit": min(max(limit, 1), 200), "offset": max(offset, 0)})
    total = rows[0]["total"] if rows else 0
    return {"total": total, "items": [{k: v for k, v in r.items() if k != "total"} for r in rows]}


def item_detail(cur, user: AuthUser, item_id: UUID) -> dict:
    """Atributos completos de la versión vigente (HU-08) con su puntuación (HU-25)."""
    item = _get_visible_item(cur, user, item_id)
    version_id, item_type = item["version_id"], item["type"]
    content = repository.get_type_content(cur, version_id, item_type)
    summary = repository.get_score_summary(cur, version_id)
    return {
        "id": item["id"], "status": item["status"], "available_to_experts": item["available_to_experts"],
        "skill": {"id": item["skill_id"], "code": item["skill_code"], "name": item["skill_name"]},
        "version": item["version"], "origin": item["origin"], "type": item_type,
        "level": item["level"], "estimated_minutes": item["estimated_minutes"],
        "evaluation_goal": item["evaluation_goal"], "statement": item["statement"],
        "content": content,
        "rubric": repository.get_rubric(cur, version_id) if item_type in OPEN_TYPES else None,
        "score": {"average": summary["average"], "count": summary["count"]},
        "my_score": repository.get_my_score(cur, version_id, user.id),
    }


def _get_visible_item(cur, user: AuthUser, item_id: UUID) -> dict:
    """Ítem con su versión vigente, si el usuario puede verlo (misma regla que el listado)."""
    item = repository.get_item_with_current_version(cur, item_id)
    es_docente = "teacher_recruiter" in user.roles
    visible = item is not None and (
        item["available_to_experts"] or (es_docente and item["created_by"] == user.id))
    if not visible or (item["status"] == "inactive" and not es_docente):
        raise NotFound("Ítem no encontrado")
    return item


# ---------- Estado (HU-09) y puntuación (HU-05) ----------


def set_status(cur, item_id: UUID, status: str) -> dict:
    if status not in ("active", "inactive"):
        raise BadRequest("status debe ser active o inactive")
    item = repository.get_item_with_current_version(cur, item_id)
    if item is None:
        raise NotFound("Ítem no encontrado")
    if item["status"] != status:
        repository.set_item_status(cur, item_id, status)
        if status == "inactive":
            emit_event(cur, "ItemDeactivated", item_id, {"item_id": str(item_id)})
    return {"id": item_id, "status": status}


def score_item(cur, user: AuthUser, item_id: UUID, score: Decimal) -> dict:
    """Registra (o reemplaza) la puntuación del validador sobre la versión vigente del ítem."""
    if not Decimal("0.0") <= score <= Decimal("5.0") or score != score.quantize(Decimal("0.1")):
        raise BadRequest("La puntuación debe estar entre 0.0 y 5.0, con un decimal")
    item = _get_visible_item(cur, user, item_id)
    repository.upsert_score(cur, item["version_id"], user.id, score)
    emit_event(cur, "ItemScored", item_id,
               {"item_id": str(item_id), "item_version_id": str(item["version_id"]),
                "validator_id": str(user.id), "score": str(score)})
    summary = repository.get_score_summary(cur, item["version_id"])
    return {"item_id": item_id, "my_score": score, "average": summary["average"], "count": summary["count"]}
