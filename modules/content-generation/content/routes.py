"""Endpoints HTTP de content: tipos, generación, listado, detalle, estado y puntuación."""
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel

from shared.db import get_conn
from shared.security import AuthUser, require_roles

from content import service
from content.types import ITEM_TYPES

router = APIRouter()
docente = require_roles("teacher_recruiter")
validador = require_roles("validator")
cualquiera = require_roles("teacher_recruiter", "validator")


class DraftRequest(BaseModel):
    skill_id: UUID
    level: int
    item_type: str
    item_count: int
    estimated_minutes: int
    context: str | None = None
    feedback: str | None = None            # al regenerar un borrador
    previous_statement: str | None = None  # enunciado del borrador que se regenera
    correct_position: int | None = None    # al regenerar una alternativa única: posición (1 a 4) de su correcta
    correct_answer: bool | None = None     # al regenerar un verdadero o falso: su respuesta correcta


class PublishGroup(BaseModel):
    skill_id: UUID
    level: int
    item_type: str
    estimated_minutes: int
    context: str | None = None
    items: list[dict]  # contenido de cada ítem, ya revisado y editado por el autor


class PublishBody(BaseModel):
    available_to_experts: bool = False
    groups: list[PublishGroup]


class EditBody(BaseModel):
    item: dict                                     # contenido completo del ítem, ya editado
    estimated_minutes: int
    available_to_experts: bool = False
    origin: Literal["edited", "regenerated"] = "edited"
    context: str | None = None                     # obligatorio si origin = regenerated


class RegenerateBody(BaseModel):
    context: str


class StatusBody(BaseModel):
    status: str


class ScoreBody(BaseModel):
    score: Decimal


@router.get("/item-types")
def list_item_types(_: AuthUser = Depends(cualquiera)):
    """HU-10: los seis tipos de ítem que soporta el banco."""
    return [{"type": t, **meta} for t, meta in ITEM_TYPES.items()]


@router.post("/drafts")
def create_drafts(body: DraftRequest, authorization: str = Header(), _: AuthUser = Depends(docente),
                  conn=Depends(get_conn, scope="function")):
    """HU-04 y HU-06: la IA genera borradores (no se guardan). También regenera uno con `feedback`."""
    with conn.cursor() as cur:
        return service.generate_drafts(cur, authorization, **body.model_dump())


@router.post("/items/publish", status_code=201)
def publish_items(body: PublishBody, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """Guarda en el banco los borradores revisados (versión 1, activos, sin puntuar)."""
    with conn.cursor() as cur:
        return service.publish_items(cur, user, available_to_experts=body.available_to_experts,
                                     groups=[g.model_dump() for g in body.groups])


@router.get("/items")
def list_items(skill_id: UUID | None = None, role_profile_id: UUID | None = None, item_type: str | None = None,
               level: int | None = None, scored: str | None = None, min_score: Decimal | None = None,
               max_score: Decimal | None = None, mine: bool = False, status: str | None = "active", limit: int = 50,
               offset: int = 0, skill_ids: list[UUID] = Query(default=[]), min_level: int | None = None,
               max_level: int | None = None, order: str = "recent", user: AuthUser = Depends(cualquiera), conn=Depends(get_conn, scope="function")):
    """HU-07 y HU-15: lista ítems activos filtrando por skill (una o varias con `skill_ids`), rol (perfil), rango de nivel,
    puntuación y más; `mine` = solo los míos; `order` elige el orden (recent, oldest, score, level_asc, level_desc, time, skill)."""
    with conn.cursor() as cur:
        return service.list_items(
            cur, user, status=status or None, skill_id=skill_id, profile_id=role_profile_id, item_type=item_type,
            level=level, scored=scored or None, min_score=min_score, max_score=max_score, limit=limit, offset=offset,
            mine=mine, skill_ids=skill_ids, min_level=min_level, max_level=max_level, order=order)


@router.get("/items/{item_id}")
def get_item(item_id: UUID, version: int | None = None, user: AuthUser = Depends(cualquiera), conn=Depends(get_conn, scope="function")):
    """HU-03, HU-08 y HU-25: atributos completos del ítem, su skill/nivel y su puntuación. Con `version`, los de esa
    versión (por defecto, la vigente)."""
    with conn.cursor() as cur:
        return service.item_detail(cur, user, item_id, version)


@router.put("/items/{item_id}", status_code=201)
def edit_item(item_id: UUID, body: EditBody, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-13, HU-14 y HU-26: versión nueva del ítem propio, o copia propia si el ítem es de otro docente."""
    with conn.cursor() as cur:
        return service.edit_item(cur, user, item_id, **body.model_dump())


@router.post("/items/{item_id}/regenerate")
def regenerate_item(item_id: UUID, body: RegenerateBody, authorization: str = Header(),
                    user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-14: la IA regenera el ítem con un nuevo contexto y devuelve una vista previa (no se guarda)."""
    with conn.cursor() as cur:
        return service.regenerate_preview(cur, authorization, user, item_id, body.context)


@router.get("/items/{item_id}/versions")
def list_versions(item_id: UUID, user: AuthUser = Depends(cualquiera), conn=Depends(get_conn, scope="function")):
    """HU-26: historial de versiones del ítem."""
    with conn.cursor() as cur:
        return service.item_versions(cur, user, item_id)


@router.patch("/items/{item_id}/status")
def set_status(item_id: UUID, body: StatusBody, user: AuthUser = Depends(docente), conn=Depends(get_conn, scope="function")):
    """HU-09: el autor activa o desactiva su ítem."""
    with conn.cursor() as cur:
        return service.set_status(cur, user, item_id, body.status)


@router.put("/items/{item_id}/score")
def score_item(item_id: UUID, body: ScoreBody, user: AuthUser = Depends(validador), conn=Depends(get_conn, scope="function")):
    """HU-05: el validador puntúa (1 a 5 estrellas enteras) la versión vigente del ítem."""
    with conn.cursor() as cur:
        return service.score_item(cur, user, item_id, body.score)
