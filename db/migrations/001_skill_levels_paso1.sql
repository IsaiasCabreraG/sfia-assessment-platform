-- Migración de una BD creada con el esquema anterior: min_level/max_level pasan a catalog.skills.
-- Paso 1 (antes de recargar el catálogo): agrega las columnas (aún nulas) y quita la copia en el perfil.
ALTER TABLE catalog.skills
    ADD COLUMN IF NOT EXISTS min_level smallint REFERENCES catalog.levels(level),
    ADD COLUMN IF NOT EXISTS max_level smallint REFERENCES catalog.levels(level);
ALTER TABLE catalog.role_profile_skills DROP COLUMN IF EXISTS min_level;
