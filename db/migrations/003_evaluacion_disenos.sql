-- Sprint 2: las reglas, skills e ítems de una evaluación pasan a un diseño (evaluation.designs) que comparten
-- evaluaciones y plantillas. Las tablas se crearon vacías; si tuvieran datos, la migración se detiene.
-- Después de aplicarla, correr db/schema.sql para crear las tablas nuevas.
DO $$
BEGIN
    IF (to_regclass('evaluation.evaluations') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.evaluations))
       OR (to_regclass('evaluation.executions') IS NOT NULL AND EXISTS (SELECT 1 FROM evaluation.executions)) THEN
        RAISE EXCEPTION 'evaluation.evaluations o evaluation.executions tienen datos: migrar a mano';
    END IF;
END $$;

DROP TABLE IF EXISTS evaluation.execution_invitees, evaluation.executions, evaluation.evaluation_items,
    evaluation.evaluation_skills, evaluation.evaluations;
