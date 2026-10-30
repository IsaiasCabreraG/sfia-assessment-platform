"""Endpoints HTTP del catálogo SFIA (HU-02): skills, niveles 1 a 7 y perfiles de rol."""
from uuid import UUID

from fastapi import APIRouter, Depends

from shared.db import get_conn
from shared.security import require_roles

from catalog import service

# Cualquier usuario con acceso a algún portal puede consultar el catálogo.
router = APIRouter(dependencies=[Depends(require_roles("teacher_recruiter", "validator", "admin"))])


@router.get("/skills")
def list_skills(q: str | None = None, category: str | None = None, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.skills(cur, q, category)


@router.get("/skills/categories")
def list_categories(conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.categories(cur)


@router.get("/skills/{skill_id}")
def get_skill(skill_id: UUID, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.skill_detail(cur, skill_id)


@router.get("/levels")
def list_levels(conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.levels(cur)


@router.get("/role-profiles")
def list_profiles(conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.profiles(cur)


@router.get("/role-profiles/{profile_id}")
def get_profile(profile_id: UUID, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return service.profile_detail(cur, profile_id)
