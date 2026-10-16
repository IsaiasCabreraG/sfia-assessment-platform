# Figura 2 — Arquitectura de la PoC

**Archivos:** `fig-02-poc-arquitectura.html` (fuente) · `fig-02-poc-arquitectura.png` (render, 1400×700 px)

**Fuente de contenido:** `../../../poc/` (código implementado) y `../poc.md`

## Propósito

Mostrar cómo está implementada la prueba de concepto: los cinco módulos independientes (frontend, auth, backend, LLM, BD), sus puertos y cómo se comunican. Cada módulo tiene variantes intercambiables.

## Elementos

| Módulo | Puerto | Variantes | Responsabilidad |
|---|---|---|---|
| Frontend | 5173 | React, Vue (Vite + TypeScript) | Detecta la variante de auth vía `GET /modulos`, guarda el JWT en `localStorage` y lo envía como Bearer |
| Auth | 8001 | Authlib, google-auth | Verifica la identidad con Google y emite el JWT HS256 (1 h). Solo emite el token; no persiste usuarios ni accede a la BD |
| Backend | 8000 | FastAPI+psycopg, FastAPI+SQLAlchemy, Node+pg | Valida el JWT, crea el usuario por `google_id`; expone `/items`, `/ai/ask`, `/modulos` |
| LLM | 8002 | Python (única) | `POST /ask`: lanza `claude -p` por subproceso, prompt por stdin, `cwd` neutro |
| PostgreSQL 16 | 5432 | — | Tablas `users` e `items`. Solo el backend accede |

Externos: Google (OIDC) y API de Claude (usada por la CLI).

## Relaciones

| Estilo | Significado |
|---|---|
| Negro | Usuario → frontend (HTTPS); frontend → auth (login) y frontend → backend (REST con Bearer JWT, que lleva `sub`, `email`, `nombre`) |
| Turquesa | REST entre módulos: backend → LLM (`POST /ask`) y backend → auth (`GET /health`) |
| Azul | SQL del backend a PostgreSQL (`INSERT` / `SELECT` sobre `users` e `items`) |
| Naranja | LLM → CLI por subproceso |
| Morado | Sistemas externos: auth ↔ Google (OIDC), CLI → API de Claude |

Login según variante: con authlib, el navegador va a `/auth/login`, Google redirige al callback del módulo y este redirige al frontend con `#access_token`. Con google-auth, el frontend obtiene el ID token con el botón de Google y hace `POST /auth/google`. Auth y backend comparten `JWT_SECRET`.

Persistencia del usuario: auth emite el JWT, el frontend lo envía en cada llamada y el backend, la primera vez que lo ve, crea la fila en `users` a partir de los claims (`sub` → `google_id`, `email`, `nombre`).

## Cómo regenerar el PNG

```
msedge --headless --hide-scrollbars --window-size=1400,700 --screenshot=fig-02-poc-arquitectura.png file:///<ruta>/fig-02-poc-arquitectura.html
```

## Nota

Solo el backend accede a la BD en la PoC; la organización de la BD en la arquitectura está por decidirse y esto es válido solo para la PoC.
