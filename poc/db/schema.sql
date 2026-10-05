-- Esquema de la PoC. Idempotente: se puede aplicar varias veces.

CREATE TABLE IF NOT EXISTS users (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      TEXT        NOT NULL UNIQUE,
    nombre     TEXT        NOT NULL,
    google_id  TEXT        NOT NULL UNIQUE,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo      TEXT        NOT NULL,
    descripcion TEXT,
    creado_por  BIGINT      NOT NULL REFERENCES users (id),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
