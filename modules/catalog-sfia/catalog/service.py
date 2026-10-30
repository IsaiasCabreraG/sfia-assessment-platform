"""Reglas de negocio del catálogo SFIA (consulta, HU-02)."""
from shared.errors import NotFound

from catalog import repository


def skills(cur, q: str | None = None, category: str | None = None) -> list[dict]:
    return repository.list_skills(cur, q or None, category or None)


def skill_detail(cur, skill_id) -> dict:
    skill = repository.get_skill(cur, skill_id)
    if skill is None:
        raise NotFound("Skill no encontrada")
    return skill


def categories(cur) -> list[str]:
    return repository.list_categories(cur)


def levels(cur) -> list[dict]:
    return repository.list_levels(cur)


def profiles(cur) -> list[dict]:
    return repository.list_profiles(cur)


def profile_detail(cur, profile_id) -> dict:
    """Perfil de rol con las skills que lo componen y el nivel mínimo de cada una."""
    profile = repository.get_profile(cur, profile_id)
    if profile is None:
        raise NotFound("Perfil de rol no encontrado")
    return {**profile, "skills": repository.get_profile_skills(cur, profile_id)}
