"""Reglas de negocio de content: generar ítems con IA, listar con filtros, ver, activar/desactivar y puntuar."""
from decimal import Decimal
from uuid import UUID, uuid4

from shared.errors import BadGateway, BadRequest, NotFound
from shared.events import emit_event
from shared.security import AuthUser

from content import repository
from content.generation import ai_log
from content.generation.balance import elegir_objetivos
from content.generation.checks import check_objetivos, check_opciones_posicionales, check_rubrica_ia
from content.generation.llm_client import ask_llm
from content.generation.parser import extract_json
from content.generation.prompts import build_prompt, build_reference_prompt
from content.generation.rubric import con_criterios_fijos
from content.generation.schemas import validate_items
from content.types import ITEM_TYPES, MAX_ITEMS_PER_REQUEST, OPEN_TYPES

MAX_ATTEMPTS = 2  # un intento más si la IA devuelve un JSON inválido o que no cumple las reglas


# ---------- Borradores (HU-04 y HU-06) ----------


def generate_drafts(cur, authorization: str, *, skill_id: UUID, level: int, item_type: str, item_count: int,
                    estimated_minutes: int, context: str | None, feedback: str | None = None,
                    previous_statement: str | None = None, correct_position: int | None = None,
                    correct_answer: bool | None = None) -> dict:
    """Pide a la IA `item_count` borradores de la skill/nivel/tipo indicados. NO guarda nada.

    Flujo: valida el pedido → elige la respuesta correcta de cada ítem para balancear el banco (alternativa
    única y verdadero o falso) → arma el prompt → llama al módulo llm → valida la respuesta (reintenta una
    vez). Los tipos abiertos se piden en dos pasos: ítem con rúbrica y luego su respuesta de referencia.
    El usuario revisa y edita los borradores en el portal y recién los guarda `publish_items`.
    Se usa también para regenerar un borrador (`item_count` = 1, con `feedback`); en ese caso
    `correct_position` o `correct_answer` conservan la correcta que tenía.
    """
    skill, level_title = _check_request(cur, skill_id, level, item_type, estimated_minutes)
    if not 1 <= item_count <= MAX_ITEMS_PER_REQUEST:
        raise BadRequest(f"La cantidad de ítems debe estar entre 1 y {MAX_ITEMS_PER_REQUEST}")
    context = (context or "").strip() or None
    objetivos = _elegir_objetivos(cur, item_type, item_count, correct_position, correct_answer)
    contents, error = _ask_for_items(
        authorization, skill=skill, level=level, level_title=level_title, item_type=item_type,
        count=item_count, minutes=estimated_minutes, context=context, objetivos=objetivos,
        feedback=(feedback or "").strip() or None, previous_statement=previous_statement,
        registro={"pedido": uuid4().hex[:8], "skill": skill["code"], "nivel": level, "tipo": item_type, "cantidad": item_count,
                  "minutos": estimated_minutes, "objetivos": objetivos, "regenera": previous_statement is not None})
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


def _elegir_objetivos(cur, item_type, count, correct_position, correct_answer) -> list | None:
    """Respuesta correcta que debe tener cada ítem nuevo, para repartir las correctas del banco (HU-04-2 y
    HU-04-7): posiciones 1 a 4 en alternativa única, verdadero (True) o falso (False) en verdadero o falso.
    Al regenerar un borrador se conserva la que tenía."""
    if item_type == "single_choice":
        if count == 1 and correct_position in (1, 2, 3, 4):
            return [correct_position]
        return [i + 1 for i in elegir_objetivos(repository.correct_position_counts(cur), count)]
    if item_type == "true_false":
        if count == 1 and correct_answer is not None:
            return [correct_answer]
        return [bool(i) for i in elegir_objetivos(repository.true_false_counts(cur), count)]
    return None


def _ask(authorization: str, armar_prompt, interpretar, registro: dict | None = None, paso: str = "completo"):
    """Llama a la IA hasta MAX_ATTEMPTS veces. `armar_prompt(error_anterior)` arma el prompt e
    `interpretar(items_crudos)` valida la respuesta (lanza ValueError si no sirve). Devuelve
    (resultado, None) o (None, mensaje de error). Cada intento se anota en el log de IA si está activo (ver ai_log)."""
    previous_error = None
    for intento in range(1, MAX_ATTEMPTS + 1):
        prompt = respuesta = None
        try:
            prompt = armar_prompt(previous_error)
            respuesta = ask_llm(prompt, authorization)
            resultado = interpretar(extract_json(respuesta)["items"])
            ai_log.registrar(**(registro or {}), paso=paso, intento=intento, prompt=prompt, respuesta=str(respuesta),
                             valido=True, errores=None, meta=getattr(respuesta, "meta", None))
            return resultado, None
        except ValueError as e:
            previous_error = str(e)
            ai_log.registrar(**(registro or {}), paso=paso, intento=intento, prompt=prompt, respuesta=None if respuesta is None else str(respuesta),
                             valido=False, errores=previous_error, meta=getattr(respuesta, "meta", None))
        except BadGateway as e:
            ai_log.registrar(**(registro or {}), paso=paso, intento=intento, prompt=prompt, respuesta=None,
                             valido=False, errores=e.mensaje)
            return None, e.mensaje  # el módulo llm no responde: reintentar no ayuda
    return None, f"La IA no devolvió ítems válidos: {previous_error}"


def _ask_for_items(authorization: str, *, skill, level, level_title, item_type, count, minutes, context,
                   feedback=None, previous_statement=None, objetivos=None, registro=None):
    """Pide los ítems a la IA. Devuelve (contenidos válidos, None) o ([], mensaje de error).

    Los tipos abiertos van en dos pasos (HU-04-4): primero ítems con sus 2 criterios propios (el servidor agrega
    los fijos), sin respuesta de referencia, y
    luego, en otra llamada, la respuesta de referencia de cada uno a partir de su rúbrica.
    """
    dos_pasos = item_type in OPEN_TYPES
    comun = dict(skill=skill, level=level, level_title=level_title, item_type=item_type)

    def paso_items(items_crudos):
        if len(items_crudos) != count:
            raise ValueError(f"se pidieron {count} ítems y llegaron {len(items_crudos)}")
        if dos_pasos:
            # La IA escribe solo 2 criterios; el servidor agrega los fijos del tipo. Se comprueba todo menos la
            # respuesta de referencia, que llega en el paso siguiente.
            check_rubrica_ia(item_type, items_crudos)
            completos = [con_criterios_fijos(item_type, i) for i in items_crudos]
            validate_items(item_type, [{**i, "reference_answer": "-"} for i in completos])
            return completos
        contenidos = validate_items(item_type, items_crudos)
        if objetivos:
            check_objetivos(item_type, contenidos, objetivos)
        if item_type == "single_choice":
            check_opciones_posicionales(contenidos)
        return contenidos

    resultado, error = _ask(
        authorization,
        lambda err: build_prompt(**comun, count=count, estimated_minutes=minutes, context=context,
                                 previous_error=err, feedback=feedback, previous_statement=previous_statement,
                                 objetivos=objetivos, sin_referencia=dos_pasos),
        paso_items, registro, paso="items" if dos_pasos else "completo")
    if resultado is None:
        return [], error
    if not dos_pasos:
        return resultado, None

    items = resultado

    def paso_referencias(referencias):
        if len(referencias) != count:
            raise ValueError(f"se pidieron {count} respuestas de referencia y llegaron {len(referencias)}")
        for i, r in enumerate(referencias, start=1):
            texto = r.get("reference_answer") if isinstance(r, dict) else None
            if not isinstance(texto, str) or not texto.strip():
                raise ValueError(f"ítem {i}: falta reference_answer")
        return validate_items(item_type, [{**item, "reference_answer": r["reference_answer"]}
                                          for item, r in zip(items, referencias)])

    contenidos, error = _ask(authorization,
                             lambda err: build_reference_prompt(**comun, items=items, previous_error=err),
                             paso_referencias, registro, paso="referencias")
    return (contenidos, None) if contenidos is not None else ([], error)


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
        if valor is not None and not Decimal(1) <= valor <= Decimal(5):
            raise BadRequest(f"{nombre} debe estar entre 1 y 5")
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
    if score != score.to_integral_value() or not 1 <= score <= 5:
        raise BadRequest("La puntuación debe ser un número entero de estrellas, de 1 a 5")
    score = int(score)
    item = _get_visible_item(cur, user, item_id)
    repository.upsert_score(cur, item["version_id"], user.id, score)
    emit_event(cur, "ItemScored", item_id,
               {"item_id": str(item_id), "item_version_id": str(item["version_id"]),
                "validator_id": str(user.id), "score": str(score)})
    summary = repository.get_score_summary(cur, item["version_id"])
    return {"item_id": item_id, "my_score": score, "average": summary["average"], "count": summary["count"]}
