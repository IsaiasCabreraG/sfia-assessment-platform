"""Capa de datos del catálogo SFIA: consultas SQL sobre el schema `catalog`."""


def list_skills(cur, q: str | None, category: str | None) -> list[dict]:
    """Skills sin la descripción larga; filtro opcional por texto (código o nombre) y categoría."""
    cur.execute(
        """
        SELECT id, code, name, category, subcategory, min_level, max_level
        FROM catalog.skills
        WHERE (%(q)s::text IS NULL OR code ILIKE '%%' || %(q)s || '%%' OR name ILIKE '%%' || %(q)s || '%%')
          AND (%(category)s::text IS NULL OR category = %(category)s)
        ORDER BY code
        """,
        {"q": q, "category": category},
    )
    return cur.fetchall()


def get_skill(cur, skill_id) -> dict | None:
    cur.execute("SELECT id, code, name, description, category, subcategory, min_level, max_level "
                "FROM catalog.skills WHERE id = %s",
                (skill_id,))
    return cur.fetchone()


def list_categories(cur) -> list[str]:
    cur.execute("SELECT DISTINCT category FROM catalog.skills WHERE category IS NOT NULL ORDER BY category")
    return [r["category"] for r in cur.fetchall()]


def list_levels(cur) -> list[dict]:
    cur.execute("SELECT level, description FROM catalog.levels ORDER BY level")
    return cur.fetchall()


def list_profiles(cur) -> list[dict]:
    cur.execute(
        """
        SELECT p.id, p.name, p.family, count(ps.skill_id)::int AS skills_count
        FROM catalog.role_profiles p
        LEFT JOIN catalog.role_profile_skills ps ON ps.profile_id = p.id
        GROUP BY p.id
        ORDER BY p.family, p.name
        """
    )
    return cur.fetchall()


def get_profile(cur, profile_id) -> dict | None:
    cur.execute("SELECT id, name, family FROM catalog.role_profiles WHERE id = %s", (profile_id,))
    return cur.fetchone()


def get_profile_skills(cur, profile_id) -> list[dict]:
    cur.execute(
        """
        SELECT s.id, s.code, s.name, s.category, s.min_level, s.max_level, ps.is_primary
        FROM catalog.role_profile_skills ps
        JOIN catalog.skills s ON s.id = ps.skill_id
        WHERE ps.profile_id = %s
        ORDER BY ps.is_primary DESC, s.code
        """,
        (profile_id,),
    )
    return cur.fetchall()
