-- Esquema del Sprint 1, traducido de docs/architecture/sprint1-db.dbml (un schema por módulo).
-- Diferencias con el DBML (a aprobar): catalog.skills.subcategory, catalog.role_profiles.family
-- y catalog.role_profile_skills.is_primary (vienen del dataset SFIA), catalog.skills.min_level/max_level (en vez de role_profile_skills.min_level)
-- y content.items.available_to_experts
-- (casilla de publicación). Es idempotente.

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS events;

-- ---------- identity ----------

CREATE TABLE IF NOT EXISTS identity.users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email      varchar     NOT NULL UNIQUE,
    name       varchar,
    avatar     varchar,
    google_id  varchar     NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.user_roles (
    user_id uuid    NOT NULL REFERENCES identity.users(id),
    role    varchar NOT NULL CHECK (role IN ('teacher_recruiter', 'validator', 'admin')),
    PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES identity.users(id),
    token_hash varchar     NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

-- ---------- catalog ----------

CREATE TABLE IF NOT EXISTS catalog.levels (
    level       smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 7),
    description text
);

CREATE TABLE IF NOT EXISTS catalog.skills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar NOT NULL UNIQUE,
    name        varchar NOT NULL,
    description text,
    category    varchar,
    subcategory varchar,
    min_level   smallint NOT NULL REFERENCES catalog.levels(level),  -- niveles en que SFIA define la skill
    max_level   smallint NOT NULL REFERENCES catalog.levels(level),
    CHECK (min_level <= max_level)
);

CREATE TABLE IF NOT EXISTS catalog.role_profiles (
    id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name   varchar NOT NULL UNIQUE,
    family varchar
);

CREATE TABLE IF NOT EXISTS catalog.role_profile_skills (
    profile_id uuid     NOT NULL REFERENCES catalog.role_profiles(id),
    skill_id   uuid     NOT NULL REFERENCES catalog.skills(id),
    is_primary boolean  NOT NULL,
    PRIMARY KEY (profile_id, skill_id)
);

-- ---------- content ----------

CREATE TABLE IF NOT EXISTS content.generation_requests (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by      uuid        NOT NULL REFERENCES identity.users(id),
    skill_id          uuid        NOT NULL REFERENCES catalog.skills(id),
    level             smallint    NOT NULL REFERENCES catalog.levels(level),
    item_type         varchar     NOT NULL
        CHECK (item_type IN ('single_choice', 'true_false', 'open_question', 'coding', 'system_design', 'debugging')),
    item_count        int         NOT NULL CHECK (item_count > 0),
    estimated_minutes int         NOT NULL CHECK (estimated_minutes > 0),
    context           text,
    status            varchar     NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.items (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status     varchar     NOT NULL CHECK (status IN ('active', 'inactive')),
    skill_id   uuid        NOT NULL REFERENCES catalog.skills(id),
    created_by uuid        NOT NULL REFERENCES identity.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Casilla "disponible para expertos" al publicar: false = uso privado (solo el autor lo ve).
ALTER TABLE content.items ADD COLUMN IF NOT EXISTS available_to_experts boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS content.item_versions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id               uuid        NOT NULL REFERENCES content.items(id),
    type                  varchar     NOT NULL
        CHECK (type IN ('single_choice', 'true_false', 'open_question', 'coding', 'system_design', 'debugging')),
    version               int         NOT NULL CHECK (version >= 1),
    origin                varchar     NOT NULL CHECK (origin IN ('generated', 'regenerated', 'edited')),
    generation_request_id uuid        REFERENCES content.generation_requests(id),
    level                 smallint    NOT NULL REFERENCES catalog.levels(level),
    estimated_minutes     int         NOT NULL CHECK (estimated_minutes > 0),
    evaluation_goal       text        NOT NULL,
    statement             text        NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id, version)
);

CREATE TABLE IF NOT EXISTS content.item_choice_options (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_version_id uuid     NOT NULL REFERENCES content.item_versions(id),
    position        smallint NOT NULL CHECK (position >= 1),
    text            text     NOT NULL,
    is_correct      boolean  NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_true_false (
    item_version_id uuid PRIMARY KEY REFERENCES content.item_versions(id),
    correct_answer  boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_open_question (
    item_version_id  uuid PRIMARY KEY REFERENCES content.item_versions(id),
    reference_answer text NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_coding (
    item_version_id    uuid PRIMARY KEY REFERENCES content.item_versions(id),
    language           varchar NOT NULL,
    function_signature text    NOT NULL,
    starter_code       text,
    unit_tests         text    NOT NULL,
    time_limit_seconds int     NOT NULL CHECK (time_limit_seconds > 0),
    memory_limit_mb    int     NOT NULL CHECK (memory_limit_mb > 0),
    reference_solution text    NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_system_design (
    item_version_id             uuid PRIMARY KEY REFERENCES content.item_versions(id),
    scenario                    text NOT NULL,
    functional_requirements     text[],
    non_functional_requirements text[],
    constraints                 text[],
    reference_answer            text NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_debugging (
    item_version_id   uuid PRIMARY KEY REFERENCES content.item_versions(id),
    language          varchar NOT NULL,
    code              text    NOT NULL,
    symptom_input     text,
    symptom_expected  text    NOT NULL,
    symptom_observed  text    NOT NULL,
    reference_answer  text    NOT NULL
);

CREATE TABLE IF NOT EXISTS content.item_findings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_version_id uuid NOT NULL REFERENCES content.item_versions(id),
    line            int  CHECK (line >= 1),
    description     text NOT NULL
);

CREATE TABLE IF NOT EXISTS content.rubric_criteria (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_version_id uuid     NOT NULL REFERENCES content.item_versions(id),
    name            varchar  NOT NULL,
    weight          smallint NOT NULL CHECK (weight BETWEEN 1 AND 100),
    position        smallint NOT NULL CHECK (position >= 1)
);

CREATE TABLE IF NOT EXISTS content.rubric_levels (
    criterion_id uuid     NOT NULL REFERENCES content.rubric_criteria(id),
    score        smallint NOT NULL CHECK (score BETWEEN 0 AND 3),
    descriptor   text     NOT NULL,
    PRIMARY KEY (criterion_id, score)
);

CREATE TABLE IF NOT EXISTS content.item_scores (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_version_id uuid         NOT NULL REFERENCES content.item_versions(id),
    validator_id    uuid         NOT NULL REFERENCES identity.users(id),
    score           smallint     NOT NULL CHECK (score BETWEEN 1 AND 5),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (item_version_id, validator_id)
);

-- ---------- events ----------

CREATE TABLE IF NOT EXISTS events.events (
    id           bigserial PRIMARY KEY,
    type         varchar     NOT NULL,
    aggregate_id uuid,
    payload      jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Niveles de responsabilidad SFIA (1 a 7): títulos genéricos de cada nivel.
INSERT INTO catalog.levels (level, description) VALUES
    (1, 'Follow'),
    (2, 'Assist'),
    (3, 'Apply'),
    (4, 'Enable'),
    (5, 'Ensure and advise'),
    (6, 'Initiate and influence'),
    (7, 'Set strategy, inspire and mobilise')
ON CONFLICT (level) DO NOTHING;

-- Índices de las consultas de listado y filtros.
CREATE INDEX IF NOT EXISTS items_skill_idx ON content.items (skill_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS scores_version_idx ON content.item_scores (item_version_id);
