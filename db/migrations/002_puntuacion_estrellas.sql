-- HU-05-2: la puntuación pasa de 0.0–5.0 con un decimal a 1–5 estrellas enteras.
-- Las puntuaciones existentes se redondean (mínimo 1).
ALTER TABLE content.item_scores DROP CONSTRAINT IF EXISTS item_scores_score_check;
ALTER TABLE content.item_scores
    ALTER COLUMN score TYPE smallint USING GREATEST(1, round(score))::smallint;
ALTER TABLE content.item_scores
    ADD CONSTRAINT item_scores_score_check CHECK (score BETWEEN 1 AND 5);
