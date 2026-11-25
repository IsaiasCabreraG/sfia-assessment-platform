"""Capa de datos del Constructor: consultas SQL sobre el schema `evaluation` (y lecturas de `catalog`)."""

# ---------- Roles propios (HU-38) ----------


def count_existing_skills(cur, skill_ids) -> int:
    cur.execute("SELECT count(*) AS n FROM catalog.skills WHERE id = ANY(%s)", (skill_ids,))
    return cur.fetchone()["n"]


def role_name_taken(cur, owner_id, name, exclude_id=None) -> bool:
    cur.execute(
        "SELECT 1 FROM evaluation.custom_roles WHERE owner_id = %s AND lower(name) = lower(%s) "
        "AND (%s::uuid IS NULL OR id <> %s)", (owner_id, name, exclude_id, exclude_id))
    return cur.fetchone() is not None


def insert_role(cur, owner_id, name) -> dict:
    cur.execute("INSERT INTO evaluation.custom_roles (owner_id, name) VALUES (%s, %s) RETURNING *", (owner_id, name))
    return cur.fetchone()


def replace_role_skills(cur, role_id, skill_ids) -> None:
    cur.execute("DELETE FROM evaluation.custom_role_skills WHERE custom_role_id = %s", (role_id,))
    cur.executemany("INSERT INTO evaluation.custom_role_skills (custom_role_id, skill_id) VALUES (%s, %s)",
                    [(role_id, s) for s in skill_ids])


def rename_role(cur, role_id, name) -> None:
    cur.execute("UPDATE evaluation.custom_roles SET name = %s WHERE id = %s", (name, role_id))


def list_roles(cur, owner_id) -> list[dict]:
    cur.execute(
        """
        SELECT r.id, r.name, r.created_at, count(s.skill_id)::int AS skills_count
        FROM evaluation.custom_roles r
        LEFT JOIN evaluation.custom_role_skills s ON s.custom_role_id = r.id
        WHERE r.owner_id = %s
        GROUP BY r.id
        ORDER BY lower(r.name)
        """, (owner_id,))
    return cur.fetchall()


def get_role(cur, role_id) -> dict | None:
    cur.execute("SELECT id, owner_id, name, created_at FROM evaluation.custom_roles WHERE id = %s", (role_id,))
    return cur.fetchone()


def get_role_skills(cur, role_id) -> list[dict]:
    cur.execute(
        """
        SELECT s.id, s.code, s.name, s.category, s.min_level, s.max_level
        FROM evaluation.custom_role_skills r JOIN catalog.skills s ON s.id = r.skill_id
        WHERE r.custom_role_id = %s ORDER BY s.code
        """, (role_id,))
    return cur.fetchall()


def delete_role(cur, role_id) -> None:
    cur.execute("DELETE FROM evaluation.custom_role_skills WHERE custom_role_id = %s", (role_id,))
    cur.execute("DELETE FROM evaluation.custom_roles WHERE id = %s", (role_id,))


# ---------- Diseños y evaluaciones (HU-11) ----------


def get_role_profile(cur, profile_id) -> dict | None:
    cur.execute("SELECT id, name FROM catalog.role_profiles WHERE id = %s", (profile_id,))
    return cur.fetchone()


def profile_skill_ids(cur, profile_id) -> set:
    """Skills que SFIA asigna al rol (core y related)."""
    cur.execute("SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = %s", (profile_id,))
    return {r["skill_id"] for r in cur.fetchall()}


def get_skill_levels(cur, skill_ids) -> dict:
    """skill_id -> (nivel mínimo, nivel máximo) en que SFIA define la skill. Las que no existen no aparecen."""
    cur.execute("SELECT id, min_level, max_level FROM catalog.skills WHERE id = ANY(%s)", (skill_ids,))
    return {r["id"]: (r["min_level"], r["max_level"]) for r in cur.fetchall()}


def insert_design(cur, role_profile_id, duration_minutes) -> dict:
    cur.execute("INSERT INTO evaluation.designs (role_profile_id, duration_minutes) VALUES (%s, %s) RETURNING *",
                (role_profile_id, duration_minutes))
    return cur.fetchone()


def update_design(cur, design_id, role_profile_id, duration_minutes) -> None:
    cur.execute("UPDATE evaluation.designs SET role_profile_id = %s, duration_minutes = %s WHERE id = %s",
                (role_profile_id, duration_minutes, design_id))


def replace_design_content(cur, design_id, skills: list, items: list) -> None:
    """Reemplaza las skills ((skill_id, nivel mínimo, nivel máximo)) y los ítems ((item_version_id, skill_id), en
    orden) del diseño."""
    cur.execute("DELETE FROM evaluation.design_items WHERE design_id = %s", (design_id,))
    cur.execute("DELETE FROM evaluation.design_skills WHERE design_id = %s", (design_id,))
    cur.executemany("INSERT INTO evaluation.design_skills (design_id, skill_id, min_level, max_level) "
                    "VALUES (%s, %s, %s, %s)", [(design_id, s, lo, hi) for s, lo, hi in skills])
    cur.executemany(
        "INSERT INTO evaluation.design_items (design_id, item_version_id, skill_id, position) VALUES (%s, %s, %s, %s)",
        [(design_id, version_id, skill_id, pos) for pos, (version_id, skill_id) in enumerate(items, start=1)])


def insert_evaluation(cur, owner_id, name, design_id) -> dict:
    cur.execute("INSERT INTO evaluation.evaluations (owner_id, name, design_id) VALUES (%s, %s, %s) RETURNING *",
                (owner_id, name, design_id))
    return cur.fetchone()


def rename_evaluation(cur, evaluation_id, name) -> None:
    cur.execute("UPDATE evaluation.evaluations SET name = %s WHERE id = %s", (name, evaluation_id))


_EVALUATION_SQL = """
SELECT e.id, e.owner_id, e.name, e.status, e.share_token, e.created_at, e.published_at, e.design_id,
       d.role_profile_id, rp.name AS role_profile_name, d.duration_minutes,
       COALESCE((SELECT sum(v.estimated_minutes) FROM evaluation.design_items di
                 JOIN content.item_versions v ON v.id = di.item_version_id
                 WHERE di.design_id = d.id), 0)::int AS recommended_minutes,
       (SELECT count(*) FROM evaluation.design_items WHERE design_id = d.id)::int AS items_count,
       (SELECT count(*) FROM evaluation.design_skills WHERE design_id = d.id)::int AS skills_count
FROM evaluation.evaluations e
JOIN evaluation.designs d ON d.id = e.design_id
LEFT JOIN catalog.role_profiles rp ON rp.id = d.role_profile_id
"""


def get_evaluation(cur, evaluation_id) -> dict | None:
    cur.execute(_EVALUATION_SQL + " WHERE e.id = %s", (evaluation_id,))
    return cur.fetchone()


def list_evaluations(cur, owner_id, status) -> list[dict]:
    cur.execute(_EVALUATION_SQL + " WHERE e.owner_id = %s AND "
                "((%s::text IS NULL AND e.status <> 'discarded') OR e.status = %s) "
                "ORDER BY e.created_at DESC", (owner_id, status, status))
    return cur.fetchall()


def set_evaluation_status(cur, evaluation_id, status) -> None:
    """Cambia el estado; al publicar registra la fecha de publicación."""
    cur.execute("UPDATE evaluation.evaluations SET status = %s, "
                "published_at = CASE WHEN %s = 'published' THEN now() ELSE published_at END WHERE id = %s",
                (status, status, evaluation_id))


def set_design_duration(cur, design_id, duration_minutes) -> None:
    cur.execute("UPDATE evaluation.designs SET duration_minutes = %s WHERE id = %s", (duration_minutes, design_id))


def get_design_skills(cur, design_id) -> list[dict]:
    cur.execute(
        """
        SELECT s.id, s.code, s.name, s.category, ds.min_level, ds.max_level,
               s.min_level AS sfia_min_level, s.max_level AS sfia_max_level,
               (SELECT count(*) FROM evaluation.design_items di
                WHERE di.design_id = ds.design_id AND di.skill_id = ds.skill_id)::int AS items_count
        FROM evaluation.design_skills ds JOIN catalog.skills s ON s.id = ds.skill_id
        WHERE ds.design_id = %s ORDER BY s.code
        """, (design_id,))
    return cur.fetchall()


def get_design_items(cur, design_id, user_id) -> list[dict]:
    """Ítems del diseño en orden, con el estado del ítem del banco (activo, público, mío)."""
    cur.execute(
        """
        SELECT di.position, i.id AS item_id, v.id AS item_version_id, v.version, di.skill_id, s.code AS skill_code,
               v.type, v.level, v.estimated_minutes, v.statement,
               i.status = 'active' AS item_active, i.available_to_experts AS item_public,
               i.created_by = %s AS is_mine
        FROM evaluation.design_items di
        JOIN content.item_versions v ON v.id = di.item_version_id
        JOIN content.items i ON i.id = v.item_id
        JOIN catalog.skills s ON s.id = di.skill_id
        WHERE di.design_id = %s ORDER BY di.position
        """, (user_id, design_id))
    return cur.fetchall()


def get_item_versions(cur, version_ids) -> list[dict]:
    """Lo necesario para validar versiones de ítems del banco antes de agregarlas a un diseño."""
    cur.execute(
        """
        SELECT v.id AS item_version_id, v.item_id, v.level, i.skill_id, s.code AS skill_code, i.status, i.created_by,
               i.available_to_experts,
               v.version = (SELECT max(version) FROM content.item_versions WHERE item_id = v.item_id) AS is_current
        FROM content.item_versions v
        JOIN content.items i ON i.id = v.item_id
        JOIN catalog.skills s ON s.id = i.skill_id
        WHERE v.id = ANY(%s)
        """, (version_ids,))
    return cur.fetchall()


_AVAILABLE_SQL = """
SELECT i.id, v.id AS version_id, s.id AS skill_id, s.code AS skill_code, s.name AS skill_name, s.category,
       v.type, v.level, v.estimated_minutes, v.statement, i.available_to_experts, (i.created_by = %(user_id)s) AS is_mine,
       sc.average AS average_score, sc.n AS scores_count,
       ds.skill_id IS NOT NULL AS skill_in_evaluation,
       CASE WHEN ds.skill_id IS NULL THEN NULL ELSE v.level BETWEEN ds.min_level AND ds.max_level END AS level_in_range,
       COALESCE(i.id = ANY(%(design_items)s::uuid[]), false) AS already_added,
       count(*) OVER () AS total
FROM content.items i
JOIN catalog.skills s ON s.id = i.skill_id
JOIN LATERAL (SELECT * FROM content.item_versions WHERE item_id = i.id ORDER BY version DESC LIMIT 1) v ON true
JOIN LATERAL (SELECT round(avg(score), 1) AS average, count(*)::int AS n
              FROM content.item_scores WHERE item_version_id = v.id) sc ON true
LEFT JOIN evaluation.design_skills ds ON ds.design_id = %(design_id)s AND ds.skill_id = i.skill_id
WHERE i.status = 'active'
  AND (i.available_to_experts OR i.created_by = %(user_id)s)
  AND (NOT %(only_rules)s OR (ds.skill_id IS NOT NULL AND v.level BETWEEN ds.min_level AND ds.max_level))
  AND (%(skill_ids)s::uuid[] IS NULL OR i.skill_id = ANY(%(skill_ids)s::uuid[]))
  AND (%(min_level)s::int IS NULL OR v.level >= %(min_level)s)
  AND (%(max_level)s::int IS NULL OR v.level <= %(max_level)s)
  AND (%(item_type)s::text IS NULL OR v.type = %(item_type)s)
  AND (%(q)s::text IS NULL OR v.statement ILIKE '%%' || %(q)s || '%%')
ORDER BY s.code, v.level, i.created_at DESC, i.id
LIMIT %(limit)s OFFSET %(offset)s
"""


def list_available_items(cur, filters: dict) -> list[dict]:
    cur.execute(_AVAILABLE_SQL, filters)
    return cur.fetchall()


def get_item_for_usage(cur, item_id) -> dict | None:
    cur.execute("SELECT id, created_by, available_to_experts FROM content.items WHERE id = %s", (item_id,))
    return cur.fetchone()


def item_usage(cur, item_id) -> dict:
    """En cuántas evaluaciones publicadas y plantillas públicas está alguna versión del ítem."""
    cur.execute(
        """
        SELECT count(DISTINCT e.id) FILTER (WHERE e.status = 'published')::int AS published_evaluations,
               count(DISTINCT t.id) FILTER (WHERE t.visibility = 'public')::int AS public_templates
        FROM content.item_versions v
        JOIN evaluation.design_items di ON di.item_version_id = v.id
        LEFT JOIN evaluation.evaluations e ON e.design_id = di.design_id
        LEFT JOIN evaluation.templates t ON t.design_id = di.design_id
        WHERE v.item_id = %s
        """, (item_id,))
    return cur.fetchone()


def design_item_ids(cur, design_id) -> list:
    """Ítems del banco (no versiones) que ya están en el diseño."""
    cur.execute("SELECT v.item_id FROM evaluation.design_items di JOIN content.item_versions v "
                "ON v.id = di.item_version_id WHERE di.design_id = %s", (design_id,))
    return [r["item_id"] for r in cur.fetchall()]


# ---------- Plantillas (HU-12) ----------


def copy_design(cur, design_id) -> dict:
    """Copia un diseño (reglas, skills e ítems) en uno nuevo e independiente."""
    cur.execute(
        "INSERT INTO evaluation.designs (role_profile_id, duration_minutes) "
        "SELECT role_profile_id, duration_minutes FROM evaluation.designs WHERE id = %s "
        "RETURNING *", (design_id,))
    nuevo = cur.fetchone()
    cur.execute("INSERT INTO evaluation.design_skills (design_id, skill_id, min_level, max_level) "
                "SELECT %s, skill_id, min_level, max_level FROM evaluation.design_skills WHERE design_id = %s",
                (nuevo["id"], design_id))
    cur.execute("INSERT INTO evaluation.design_items (design_id, item_version_id, skill_id, position) "
                "SELECT %s, item_version_id, skill_id, position FROM evaluation.design_items WHERE design_id = %s",
                (nuevo["id"], design_id))
    return nuevo


def insert_template(cur, owner_id, name, visibility, design_id) -> dict:
    cur.execute("INSERT INTO evaluation.templates (owner_id, name, visibility, design_id) VALUES (%s, %s, %s, %s) "
                "RETURNING *", (owner_id, name, visibility, design_id))
    return cur.fetchone()


def update_template(cur, template_id, name, visibility) -> None:
    cur.execute("UPDATE evaluation.templates SET name = %s, visibility = %s, updated_at = now() WHERE id = %s",
                (name, visibility, template_id))


_TEMPLATE_SQL = """
SELECT t.id, t.owner_id, u.name AS owner_name, t.name, t.visibility, t.created_at, t.updated_at, t.design_id,
       d.role_profile_id, rp.name AS role_profile_name, d.duration_minutes,
       (SELECT count(*) FROM evaluation.design_items WHERE design_id = d.id)::int AS items_count,
       (SELECT count(*) FROM evaluation.design_skills WHERE design_id = d.id)::int AS skills_count
FROM evaluation.templates t
JOIN evaluation.designs d ON d.id = t.design_id
JOIN identity.users u ON u.id = t.owner_id
LEFT JOIN catalog.role_profiles rp ON rp.id = d.role_profile_id
"""


def get_template(cur, template_id) -> dict | None:
    cur.execute(_TEMPLATE_SQL + " WHERE t.id = %s", (template_id,))
    return cur.fetchone()


def list_templates(cur, user_id) -> list[dict]:
    """Las plantillas del usuario y las públicas de otros (la disponibilidad se calcula en el servicio)."""
    cur.execute(_TEMPLATE_SQL + " WHERE t.owner_id = %s OR t.visibility = 'public' "
                "ORDER BY t.updated_at DESC", (user_id,))
    return cur.fetchall()


def delete_template(cur, template_id, design_id) -> None:
    cur.execute("DELETE FROM evaluation.templates WHERE id = %s", (template_id,))
    cur.execute("DELETE FROM evaluation.design_items WHERE design_id = %s", (design_id,))
    cur.execute("DELETE FROM evaluation.design_skills WHERE design_id = %s", (design_id,))
    cur.execute("DELETE FROM evaluation.designs WHERE id = %s", (design_id,))


def publish_items(cur, item_ids) -> None:
    """Deja disponibles para expertos (públicos) estos ítems del banco."""
    cur.execute("UPDATE content.items SET available_to_experts = true WHERE id = ANY(%s)", (item_ids,))
