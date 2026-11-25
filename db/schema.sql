-- Esquemas de los Sprints 1 y 2, traducidos de docs/architecture/db.dbml (un schema por módulo).
-- Diferencias con el DBML (a aprobar): catalog.skills.subcategory, catalog.role_profiles.family
-- y catalog.role_profile_skills.is_primary (vienen del dataset SFIA), catalog.skills.min_level/max_level (en vez de role_profile_skills.min_level)
-- y content.items.available_to_experts y source_item_id
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
-- Si el ítem es una copia de otro (al editar o regenerar uno ajeno), cuál es el original.
ALTER TABLE content.items ADD COLUMN IF NOT EXISTS source_item_id uuid REFERENCES content.items(id);

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

-- ---------- evaluation (Sprint 2: Constructor de Evaluaciones) ----------

CREATE SCHEMA IF NOT EXISTS evaluation;

-- Diseño: reglas, skills e ítems de una evaluación o de una plantilla (HU-11, HU-12). Cada evaluación y cada
-- plantilla tiene el suyo (1 a 1); usar una plantilla o guardar una evaluación como plantilla copia el diseño.
CREATE TABLE IF NOT EXISTS evaluation.designs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_profile_id  uuid     REFERENCES catalog.role_profiles(id),   -- rol de base (informativo)
    duration_minutes int      CHECK (duration_minutes > 0)
);

-- Los niveles son de cada skill (por defecto, el rango en que SFIA la define).
CREATE TABLE IF NOT EXISTS evaluation.design_skills (
    design_id uuid     NOT NULL REFERENCES evaluation.designs(id),
    skill_id  uuid     NOT NULL REFERENCES catalog.skills(id),
    min_level smallint NOT NULL REFERENCES catalog.levels(level),
    max_level smallint NOT NULL REFERENCES catalog.levels(level),
    PRIMARY KEY (design_id, skill_id),
    CHECK (min_level <= max_level)
);

-- La FK compuesta impide agregar un ítem cuya skill no esté seleccionada en el diseño.
-- Que skill_id coincida con la skill real del ítem (content.items.skill_id) lo garantiza el servicio.
CREATE TABLE IF NOT EXISTS evaluation.design_items (
    design_id       uuid     NOT NULL REFERENCES evaluation.designs(id),
    item_version_id uuid     NOT NULL REFERENCES content.item_versions(id),
    skill_id        uuid     NOT NULL,
    position        smallint NOT NULL CHECK (position >= 1),
    PRIMARY KEY (design_id, item_version_id),
    FOREIGN KEY (design_id, skill_id) REFERENCES evaluation.design_skills(design_id, skill_id)
);

CREATE TABLE IF NOT EXISTS evaluation.evaluations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid        NOT NULL REFERENCES identity.users(id),
    name         varchar     NOT NULL,
    status       varchar     NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'discarded')),
    design_id    uuid        NOT NULL UNIQUE REFERENCES evaluation.designs(id),
    share_token  varchar     UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);

-- Una plantilla nunca se publica ni se ejecuta; vive aunque la evaluación de la que salió termine (HU-12).
CREATE TABLE IF NOT EXISTS evaluation.templates (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid        NOT NULL REFERENCES identity.users(id),
    name       varchar     NOT NULL,
    visibility varchar     NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    design_id  uuid        NOT NULL UNIQUE REFERENCES evaluation.designs(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rol propio (HU-38): solo privado; lo edita y borra su dueño.
CREATE TABLE IF NOT EXISTS evaluation.custom_roles (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid        NOT NULL REFERENCES identity.users(id),
    name       varchar     NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluation.custom_role_skills (
    custom_role_id uuid NOT NULL REFERENCES evaluation.custom_roles(id),
    skill_id       uuid NOT NULL REFERENCES catalog.skills(id),
    PRIMARY KEY (custom_role_id, skill_id)
);

-- Ejecuciones (HU-32, HU-16-4) e invitados (HU-16-2, HU-16-3). La vigencia del token es la de la ejecución.
CREATE TABLE IF NOT EXISTS evaluation.executions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id uuid        NOT NULL REFERENCES evaluation.evaluations(id),
    name          varchar     NOT NULL,
    starts_at     timestamptz NOT NULL,
    ends_at       timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS evaluation.execution_invitees (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id uuid    NOT NULL REFERENCES evaluation.executions(id),
    email        varchar NOT NULL,
    token_hash   varchar NOT NULL UNIQUE,
    UNIQUE (execution_id, email)
);
