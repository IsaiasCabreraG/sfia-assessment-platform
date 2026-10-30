-- Paso 2 (después de correr db/seed_catalog.py): exige los valores y su coherencia.
ALTER TABLE catalog.skills ALTER COLUMN min_level SET NOT NULL, ALTER COLUMN max_level SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE catalog.skills ADD CONSTRAINT skills_min_le_max CHECK (min_level <= max_level);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
