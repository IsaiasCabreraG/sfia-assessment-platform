"""Capa de datos de content: SQL sobre el schema `content` (y lecturas de `catalog`)."""
from uuid import UUID

# ---------- Pedidos de generación ----------


def insert_generation_request(cur, user_id, skill_id, level, item_type, count, minutes, context, status) -> dict:
    cur.execute(
        """
        INSERT INTO content.generation_requests
            (requested_by, skill_id, level, item_type, item_count, estimated_minutes, context, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *
        """,
        (user_id, skill_id, level, item_type, count, minutes, context, status),
    )
    return cur.fetchone()


# ---------- Ítems y versiones ----------


def insert_item(cur, skill_id, user_id, available_to_experts: bool, source_item_id=None) -> dict:
    cur.execute(
        "INSERT INTO content.items (status, skill_id, created_by, available_to_experts, source_item_id) "
        "VALUES ('active', %s, %s, %s, %s) RETURNING *",
        (skill_id, user_id, available_to_experts, source_item_id),
    )
    return cur.fetchone()


def insert_version(cur, *, item_id, version, type, origin, request_id, level, minutes, goal, statement) -> dict:
    cur.execute(
        """
        INSERT INTO content.item_versions
            (item_id, version, type, origin, generation_request_id, level, estimated_minutes,
             evaluation_goal, statement)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *
        """,
        (item_id, version, type, origin, request_id, level, minutes, goal, statement),
    )
    return cur.fetchone()


def insert_content(cur, version_id, item_type: str, c) -> None:
    """Guarda el contenido propio del tipo (tabla de extensión, opciones, hallazgos y rúbrica)."""
    if item_type == "single_choice":
        for pos, o in enumerate(c.options, start=1):
            cur.execute(
                "INSERT INTO content.item_choice_options (item_version_id, position, text, is_correct) "
                "VALUES (%s, %s, %s, %s)", (version_id, pos, o.text, o.is_correct))
    elif item_type == "true_false":
        cur.execute("INSERT INTO content.item_true_false (item_version_id, correct_answer) VALUES (%s, %s)",
                    (version_id, c.correct_answer))
    elif item_type == "open_question":
        cur.execute("INSERT INTO content.item_open_question (item_version_id, reference_answer) VALUES (%s, %s)",
                    (version_id, c.reference_answer))
    elif item_type == "coding":
        cur.execute(
            "INSERT INTO content.item_coding (item_version_id, language, function_signature, starter_code, "
            "unit_tests, time_limit_seconds, memory_limit_mb, reference_solution) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (version_id, c.language, c.function_signature, c.starter_code, c.unit_tests,
             c.time_limit_seconds, c.memory_limit_mb, c.reference_solution))
    elif item_type == "system_design":
        cur.execute(
            "INSERT INTO content.item_system_design (item_version_id, scenario, functional_requirements, "
            "non_functional_requirements, constraints, reference_answer) VALUES (%s, %s, %s, %s, %s, %s)",
            (version_id, c.scenario, c.functional_requirements, c.non_functional_requirements,
             c.constraints, c.reference_answer))
    elif item_type == "debugging":
        cur.execute(
            "INSERT INTO content.item_debugging (item_version_id, language, code, symptom_input, "
            "symptom_expected, symptom_observed, reference_answer) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (version_id, c.language, c.code, c.symptom_input, c.symptom_expected, c.symptom_observed,
             c.reference_answer))
        for f in c.findings:
            cur.execute("INSERT INTO content.item_findings (item_version_id, line, description) "
                        "VALUES (%s, %s, %s)", (version_id, f.line, f.description))
    if hasattr(c, "rubric"):
        for pos, crit in enumerate(c.rubric, start=1):
            cur.execute(
                "INSERT INTO content.rubric_criteria (item_version_id, name, weight, position) "
                "VALUES (%s, %s, %s, %s) RETURNING id", (version_id, crit.name, crit.weight, pos))
            criterion_id = cur.fetchone()["id"]
            for lvl in crit.levels:
                cur.execute("INSERT INTO content.rubric_levels (criterion_id, score, descriptor) "
                            "VALUES (%s, %s, %s)", (criterion_id, lvl.score, lvl.descriptor))


def lock_item(cur, item_id) -> None:
    """Bloquea la fila del ítem hasta el fin de la transacción: evita dos versiones nuevas simultáneas."""
    cur.execute("SELECT id FROM content.items WHERE id = %s FOR UPDATE", (item_id,))


def set_item_availability(cur, item_id, available_to_experts: bool) -> None:
    cur.execute("UPDATE content.items SET available_to_experts = %s WHERE id = %s", (available_to_experts, item_id))


def list_versions(cur, item_id) -> list[dict]:
    """Historial del ítem: la más reciente primero, con la puntuación de cada versión."""
    cur.execute(
        """
        SELECT v.id, v.version, v.origin, v.estimated_minutes, v.created_at, sc.average, sc.n AS count
        FROM content.item_versions v
        JOIN LATERAL (SELECT round(avg(score), 1) AS average, count(*)::int AS n
                      FROM content.item_scores WHERE item_version_id = v.id) sc ON true
        WHERE v.item_id = %s
        ORDER BY v.version DESC
        """,
        (item_id,),
    )
    return cur.fetchall()


# ---------- Distribución de las respuestas correctas del banco (HU-04-2 y HU-04-7) ----------


def correct_position_counts(cur) -> list[int]:
    """Cuántas alternativas únicas del banco tienen su correcta en A, B, C y D (todas las versiones)."""
    cur.execute("SELECT position, count(*)::int AS n FROM content.item_choice_options "
                "WHERE is_correct AND position BETWEEN 1 AND 4 GROUP BY position")
    por_posicion = {r["position"]: r["n"] for r in cur.fetchall()}
    return [por_posicion.get(p, 0) for p in (1, 2, 3, 4)]


def true_false_counts(cur) -> list[int]:
    """Cuántos verdadero o falso del banco tienen como correcta [falso, verdadero]."""
    cur.execute("SELECT correct_answer, count(*)::int AS n FROM content.item_true_false GROUP BY correct_answer")
    por_respuesta = {r["correct_answer"]: r["n"] for r in cur.fetchall()}
    return [por_respuesta.get(False, 0), por_respuesta.get(True, 0)]


# ---------- Listado con filtros (HU-07) y puntuación promedio (HU-25) ----------

_LIST_SQL = """
SELECT i.id, i.status, i.created_at, i.available_to_experts,
       s.id AS skill_id, s.code AS skill_code, s.name AS skill_name,
       v.id AS version_id, v.version, v.type, v.level, v.estimated_minutes, v.statement,
       sc.average AS average_score, sc.n AS scores_count,
       count(*) OVER () AS total
FROM content.items i
JOIN catalog.skills s ON s.id = i.skill_id
JOIN LATERAL (SELECT * FROM content.item_versions WHERE item_id = i.id ORDER BY version DESC LIMIT 1) v ON true
JOIN LATERAL (SELECT round(avg(score), 1) AS average, count(*)::int AS n
              FROM content.item_scores WHERE item_version_id = v.id) sc ON true
WHERE (%(status)s::text IS NULL OR i.status = %(status)s)
  AND (i.available_to_experts OR (NOT %(only_available)s AND i.created_by = %(user_id)s))
  AND (NOT %(mine)s OR i.created_by = %(user_id)s)
  AND (%(skill_id)s::uuid IS NULL OR i.skill_id = %(skill_id)s)
  AND (%(skill_ids)s::uuid[] IS NULL OR i.skill_id = ANY(%(skill_ids)s::uuid[]))
  AND (%(profile_id)s::uuid IS NULL OR i.skill_id IN
        (SELECT skill_id FROM catalog.role_profile_skills WHERE profile_id = %(profile_id)s))
  AND (%(item_type)s::text IS NULL OR v.type = %(item_type)s)
  AND (%(level)s::int IS NULL OR v.level = %(level)s)
  AND (%(min_level)s::int IS NULL OR v.level >= %(min_level)s)
  AND (%(max_level)s::int IS NULL OR v.level <= %(max_level)s)
  AND (%(scored)s::text IS NULL OR (%(scored)s = 'scored') = (sc.n > 0))
  AND (%(min_score)s::numeric IS NULL OR sc.average >= %(min_score)s)
  AND (%(max_score)s::numeric IS NULL OR sc.average <= %(max_score)s)
ORDER BY {order}, i.id
LIMIT %(limit)s OFFSET %(offset)s
"""

# Ordenamientos del listado: el valor de `order` elige uno de estos fragmentos (nunca se interpola texto del usuario).
ORDERS = {
    "recent": "i.created_at DESC",
    "oldest": "i.created_at",
    "score": "sc.average DESC NULLS LAST",
    "level_asc": "v.level, s.code",
    "level_desc": "v.level DESC, s.code",
    "time": "v.estimated_minutes, s.code",
    "skill": "s.code, v.level",
}


def list_items(cur, filters: dict) -> list[dict]:
    cur.execute(_LIST_SQL.format(order=ORDERS[filters["order"]]), filters)
    return cur.fetchall()


# ---------- Detalle (HU-08) ----------


def get_item_with_current_version(cur, item_id) -> dict | None:
    cur.execute(
        """
        SELECT i.id, i.status, i.created_at, i.created_by, i.available_to_experts, i.source_item_id,
               s.id AS skill_id, s.code AS skill_code, s.name AS skill_name,
               v.id AS version_id, v.version, v.type, v.origin, v.level, v.estimated_minutes,
               v.evaluation_goal, v.statement
        FROM content.items i
        JOIN catalog.skills s ON s.id = i.skill_id
        JOIN LATERAL (SELECT * FROM content.item_versions WHERE item_id = i.id ORDER BY version DESC LIMIT 1) v ON true
        WHERE i.id = %s
        """,
        (item_id,),
    )
    return cur.fetchone()


def get_item_with_version(cur, item_id, version) -> dict | None:
    """El ítem con una versión concreta (no necesariamente la vigente)."""
    cur.execute(
        """
        SELECT i.id, i.status, i.created_at, i.created_by, i.available_to_experts, i.source_item_id,
               s.id AS skill_id, s.code AS skill_code, s.name AS skill_name,
               v.id AS version_id, v.version, v.type, v.origin, v.level, v.estimated_minutes,
               v.evaluation_goal, v.statement
        FROM content.items i
        JOIN catalog.skills s ON s.id = i.skill_id
        JOIN content.item_versions v ON v.item_id = i.id AND v.version = %s
        WHERE i.id = %s
        """,
        (version, item_id),
    )
    return cur.fetchone()


_EXTENSION_SQL = {
    "true_false": "SELECT correct_answer FROM content.item_true_false WHERE item_version_id = %s",
    "open_question": "SELECT reference_answer FROM content.item_open_question WHERE item_version_id = %s",
    "coding": "SELECT language, function_signature, starter_code, unit_tests, time_limit_seconds, "
              "memory_limit_mb, reference_solution FROM content.item_coding WHERE item_version_id = %s",
    "system_design": "SELECT scenario, functional_requirements, non_functional_requirements, constraints, "
                     "reference_answer FROM content.item_system_design WHERE item_version_id = %s",
    "debugging": "SELECT language, code, symptom_input, symptom_expected, symptom_observed, reference_answer "
                 "FROM content.item_debugging WHERE item_version_id = %s",
}


def get_type_content(cur, version_id, item_type: str) -> dict:
    """Contenido propio del tipo (incluye las respuestas correctas; el filtrado por tipo lo hace service)."""
    if item_type == "single_choice":
        cur.execute("SELECT position, text, is_correct FROM content.item_choice_options "
                    "WHERE item_version_id = %s ORDER BY position", (version_id,))
        return {"options": cur.fetchall()}
    cur.execute(_EXTENSION_SQL[item_type], (version_id,))
    content = cur.fetchone()
    if item_type == "debugging":
        cur.execute("SELECT line, description FROM content.item_findings WHERE item_version_id = %s "
                    "ORDER BY line NULLS LAST", (version_id,))
        content["findings"] = cur.fetchall()
    return content


def get_rubric(cur, version_id) -> list[dict]:
    cur.execute(
        """
        SELECT c.id, c.name, c.weight, c.position, l.score, l.descriptor
        FROM content.rubric_criteria c
        JOIN content.rubric_levels l ON l.criterion_id = c.id
        WHERE c.item_version_id = %s
        ORDER BY c.position, l.score
        """,
        (version_id,),
    )
    criteria: dict[UUID, dict] = {}
    for r in cur.fetchall():
        crit = criteria.setdefault(r["id"], {"name": r["name"], "weight": r["weight"], "levels": []})
        crit["levels"].append({"score": r["score"], "descriptor": r["descriptor"]})
    return list(criteria.values())


# ---------- Estado y puntuaciones ----------


def set_item_status(cur, item_id, status: str) -> None:
    cur.execute("UPDATE content.items SET status = %s WHERE id = %s", (status, item_id))


def upsert_score(cur, version_id, validator_id, score) -> None:
    """Un validador tiene una puntuación por versión; si vuelve a puntuar, la reemplaza."""
    cur.execute(
        """
        INSERT INTO content.item_scores (item_version_id, validator_id, score) VALUES (%s, %s, %s)
        ON CONFLICT (item_version_id, validator_id) DO UPDATE SET score = EXCLUDED.score, created_at = now()
        """,
        (version_id, validator_id, score),
    )


def get_score_summary(cur, version_id) -> dict:
    """Promedio (None si nadie puntuó: distinto de 0.0) y cantidad de puntuaciones de una versión."""
    cur.execute("SELECT round(avg(score), 1) AS average, count(*)::int AS count FROM content.item_scores "
                "WHERE item_version_id = %s", (version_id,))
    return cur.fetchone()


def get_my_score(cur, version_id, validator_id):
    cur.execute("SELECT score FROM content.item_scores WHERE item_version_id = %s AND validator_id = %s",
                (version_id, validator_id))
    row = cur.fetchone()
    return row["score"] if row else None


# ---------- Lecturas de catalog que necesita content ----------


def get_skill(cur, skill_id) -> dict | None:
    cur.execute("SELECT id, code, name, description FROM catalog.skills WHERE id = %s", (skill_id,))
    return cur.fetchone()


def get_level_title(cur, level: int) -> str | None:
    cur.execute("SELECT description FROM catalog.levels WHERE level = %s", (level,))
    row = cur.fetchone()
    return row["description"] if row else None
