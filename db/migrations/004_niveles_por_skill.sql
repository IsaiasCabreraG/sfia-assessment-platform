-- Sprint 2: los niveles pasan de la evaluación a cada skill (design_skills.min_level y max_level) y se elimina
-- la procedencia core/related/custom. Las tablas afectadas se crearon vacías; si tuvieran datos, la migración se
-- detiene. Después de aplicarla, correr db/schema.sql para crear las tablas nuevas.
DO $$
BEGIN
    IF (to_regclass('evaluation.evaluations') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.evaluations))
       OR (to_regclass('evaluation.templates') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.templates))
       OR (to_regclass('evaluation.designs') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.designs))
       OR (to_regclass('evaluation.executions') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.executions)) THEN
        RAISE EXCEPTION 'las tablas de evaluation tienen datos: migrar a mano';
    END IF;
END $$;

DROP TABLE IF EXISTS evaluation.execution_invitees, evaluation.executions, evaluation.templates,
    evaluation.evaluations, evaluation.design_items, evaluation.design_skills, evaluation.designs;
