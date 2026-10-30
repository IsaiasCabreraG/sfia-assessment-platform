"""Carga el catálogo SFIA (skills, perfiles de rol y su relación) desde db/data/*.csv.

Los CSV son un recorte de `dataset_sfia.csv` y `skills_sfia9_descriptivo.csv`. Es idempotente:
vuelve a correr sin duplicar (actualiza por código de skill y por nombre de perfil).
Uso: bash tools/run_python.sh db/seed_catalog.py
"""
import csv
from pathlib import Path

from shared.db import connect

DATA = Path(__file__).parent / "data"


def read(nombre: str) -> list[dict]:
    with open(DATA / nombre, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def seed_skills(cur) -> None:
    for r in read("skills.csv"):
        cur.execute(
            """
            INSERT INTO catalog.skills (code, name, description, category, subcategory, min_level, max_level)
            VALUES (%s, %s, %s, NULLIF(%s, ''), NULLIF(%s, ''), %s, %s)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                category = EXCLUDED.category, subcategory = EXCLUDED.subcategory,
                min_level = EXCLUDED.min_level, max_level = EXCLUDED.max_level
            """,
            (r["code"], r["name"], r["description"], r["category"], r["subcategory"],
             int(r["min_level"]), int(r["max_level"])),
        )


def seed_profiles(cur) -> None:
    for r in read("role_profiles.csv"):
        cur.execute(
            """
            INSERT INTO catalog.role_profiles (name, family) VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE SET family = EXCLUDED.family
            """,
            (r["name"], r["family"]),
        )


def seed_profile_skills(cur) -> None:
    for r in read("role_profile_skills.csv"):
        cur.execute(
            """
            INSERT INTO catalog.role_profile_skills (profile_id, skill_id, is_primary)
            SELECT p.id, s.id, %s
            FROM catalog.role_profiles p, catalog.skills s
            WHERE p.name = %s AND s.code = %s
            ON CONFLICT (profile_id, skill_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
            """,
            (r["is_primary"] == "true", r["role_name"], r["skill_code"]),
        )


def main() -> None:
    with connect() as conn, conn.cursor() as cur:
        seed_skills(cur)
        seed_profiles(cur)
        seed_profile_skills(cur)
        cur.execute("SELECT (SELECT count(*) FROM catalog.skills) s, (SELECT count(*) FROM catalog.role_profiles) p, "
                    "(SELECT count(*) FROM catalog.role_profile_skills) ps")
        print("Catálogo cargado:", cur.fetchone())


if __name__ == "__main__":
    main()
