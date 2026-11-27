"""Endpoints HTTP del Constructor de Evaluaciones (Sprint 2)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from shared.db import get_conn
from shared.security import AuthUser, require_roles

from builder import service

# Solo el docente/reclutador arma evaluaciones.
docente = require_roles("teacher_recruiter")
router = APIRouter(dependencies=[Depends(docente)])


class RoleBody(BaseModel):
    name: str
    skill_ids: list[UUID]


@router.post("/custom-roles", status_code=201)
def create_role(body: RoleBody, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-38: guarda las skills elegidas como un rol propio (solo privado)."""
    with conn.cursor() as cur:
        return service.create_role(cur, user, body.name, body.skill_ids)


@router.get("/custom-roles")
def list_roles(user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.list_roles(cur, user)


@router.get("/custom-roles/{role_id}")
def get_role(role_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.role_detail(cur, user, role_id)


@router.put("/custom-roles/{role_id}")
def update_role(role_id: UUID, body: RoleBody, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.update_role(cur, user, role_id, body.name, body.skill_ids)


@router.delete("/custom-roles/{role_id}")
def delete_role(role_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.delete_role(cur, user, role_id)


# ---------- Evaluaciones (HU-11) ----------


class SkillLevels(BaseModel):
    """Una skill de la evaluación con sus niveles; si no se indican, son los que SFIA define para la skill."""
    skill_id: UUID
    min_level: int | None = None
    max_level: int | None = None


class EvaluationCreate(BaseModel):
    name: str
    role_profile_id: UUID | None = None  # rol de base (informativo)
    duration_minutes: int | None = None
    skills: list[SkillLevels] = []


class EvaluationUpdate(BaseModel):
    """Todos los campos son opcionales: lo que no se envía no cambia."""
    name: str | None = None
    role_profile_id: UUID | None = None
    duration_minutes: int | None = None
    skills: list[SkillLevels] | None = None
    item_version_ids: list[UUID] | None = None


@router.post("/evaluations", status_code=201)
def create_evaluation(body: EvaluationCreate, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-11: paso 1, crea un borrador con las reglas (rol, niveles, duración) y las skills."""
    with conn.cursor() as cur:
        return service.create_evaluation(cur, user, body.model_dump())


@router.get("/evaluations")
def list_evaluations(status: str | None = None, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.list_evaluations(cur, user, status or None)


@router.get("/evaluations/{evaluation_id}")
def get_evaluation(evaluation_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.evaluation_detail(cur, user, evaluation_id)


@router.put("/evaluations/{evaluation_id}")
def update_evaluation(evaluation_id: UUID, body: EvaluationUpdate, user: AuthUser = Depends(docente),
                      conn=Depends(get_conn, scope="function")):
    """HU-11: modifica reglas, skills o ítems de un borrador (solo lo que se envía)."""
    with conn.cursor() as cur:
        return service.update_evaluation(cur, user, evaluation_id, body.model_dump(exclude_unset=True))


class EvaluationDuplicate(BaseModel):
    name: str | None = None


@router.post("/evaluations/{evaluation_id}/publish")
def publish_evaluation(evaluation_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-12: publica un borrador; desde entonces no se modifica."""
    with conn.cursor() as cur:
        return service.publish_evaluation(cur, user, evaluation_id)


@router.post("/evaluations/{evaluation_id}/discard")
def discard_evaluation(evaluation_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-12-3: descarta la evaluación; deja de aparecer entre las disponibles."""
    with conn.cursor() as cur:
        return service.discard_evaluation(cur, user, evaluation_id)


@router.post("/evaluations/{evaluation_id}/duplicate", status_code=201)
def duplicate_evaluation(evaluation_id: UUID, body: EvaluationDuplicate, user: AuthUser = Depends(docente),
                         conn=Depends(get_conn, scope="function")):
    """Crea un borrador nuevo copiando el diseño de la evaluación (para cambiar una publicada)."""
    with conn.cursor() as cur:
        return service.duplicate_evaluation(cur, user, evaluation_id, body.name)


@router.get("/items/{item_id}/usage")
def item_usage(item_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """Dónde se usa un ítem: evaluaciones publicadas y plantillas públicas (para avisar antes de desactivarlo)."""
    with conn.cursor() as cur:
        return service.item_usage(cur, user, item_id)


@router.get("/available-items")
def available_items(skill_ids: list[UUID] = Query(default=[]), min_level: int | None = None,
                    max_level: int | None = None, item_type: str | None = None, q: str | None = None,
                    evaluation_id: UUID | None = None, only_rules: bool = False, limit: int = 20, offset: int = 0,
                    order: str = "skill", user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-11: ítems del banco que se pueden agregar, con filtros libres."""
    with conn.cursor() as cur:
        return service.available_items(
            cur, user, skill_ids=skill_ids, min_level=min_level, max_level=max_level, item_type=item_type, q=q,
            evaluation_id=evaluation_id, only_rules=only_rules, limit=limit, offset=offset, order=order)


# ---------- Plantillas (HU-12) ----------


class TemplateFromEvaluation(BaseModel):
    name: str
    visibility: str = "private"
    make_items_public: bool = False  # confirmación: hacer públicos mis ítems privados para publicar la plantilla


class TemplateUpdate(BaseModel):
    """Todos los campos son opcionales: lo que no se envía no cambia."""
    name: str | None = None
    visibility: str | None = None
    make_items_public: bool = False
    role_profile_id: UUID | None = None
    duration_minutes: int | None = None
    skills: list[SkillLevels] | None = None
    item_version_ids: list[UUID] | None = None


class TemplateUse(BaseModel):
    name: str | None = None


@router.post("/evaluations/{evaluation_id}/template", status_code=201)
def save_as_template(evaluation_id: UUID, body: TemplateFromEvaluation, user: AuthUser = Depends(docente),
                     conn=Depends(get_conn, scope="function")):
    """HU-12: guarda una copia del diseño de la evaluación como plantilla, privada o pública."""
    with conn.cursor() as cur:
        return service.save_as_template(cur, user, evaluation_id, body.name, body.visibility, body.make_items_public)


@router.get("/templates")
def list_templates(user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.list_templates(cur, user)


@router.get("/templates/{template_id}")
def get_template(template_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.template_detail(cur, user, template_id)


@router.put("/templates/{template_id}")
def update_template(template_id: UUID, body: TemplateUpdate, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-12 y HU-12-2: cambia el nombre, la visibilidad o el diseño de una plantilla propia."""
    with conn.cursor() as cur:
        return service.update_template(cur, user, template_id, body.model_dump(exclude_unset=True))


@router.post("/templates/{template_id}/use", status_code=201)
def use_template(template_id: UUID, body: TemplateUse, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-11 (paso 1): crea un borrador a partir de una plantilla propia o pública."""
    with conn.cursor() as cur:
        return service.use_template(cur, user, template_id, body.name)


@router.delete("/templates/{template_id}")
def delete_template(template_id: UUID, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    with conn.cursor() as cur:
        return service.delete_template(cur, user, template_id)
