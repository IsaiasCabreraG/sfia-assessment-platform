# Arquitectura - Módulos Lógicos

Plataforma de evaluación técnica y práctica para ingeniería de software basada en SFIA.

---

## 1. Catálogo SFIA

**Responsabilidad**: Fuente de verdad de la taxonomía SFIA (skills, niveles 1-7, perfiles de rol, mapeos skill ↔ contenido).

**Owns (datos)**:
- `sfia.skills` — código, nombre, descripción, categoría
- `sfia.levels` — nivel 1-7, descripción genérica de responsabilidad
- `sfia.role_profiles` — perfil (ej: "Software Engineer L3"), skills requeridos con nivel mínimo
- `sfia.skill_content_mapping` — skill_id ↔ content_item_id (qué items evalúan qué skill)

**API (REST)**:
```
GET    /skills                    # Lista skills con filtros (categoría, nivel)
GET    /skills/{id}               # Detalle skill + niveles
GET    /role-profiles             # Perfiles predefinidos
GET    /role-profiles/{id}        # Skills de un perfil
GET    /mappings?skill_id=xxx     # Items de contenido mapeados a skill
POST   /skills                    # Admin: crear skill
PUT    /skills/{id}               # Admin: actualizar
POST   /role-profiles             # Admin: crear perfil
```

**Eventos que emite** (tabla `events`):
| Evento | Payload clave |
|---|---|
| `SkillCreated` | `skill_id, code, name, category` |
| `SkillUpdated` | `skill_id, changes` |
| `ProfileCreated` | `profile_id, name, skills[]` |
| `ProfileUpdated` | `profile_id, changes` |
| `MappingChanged` | `skill_id, content_item_id, action` |

**Consumidores**: Generación de Contenido, Constructor de Evaluaciones (backend)

---

## 2. Generación de Contenido

**Responsabilidad**: Crear, versionar y validar items de evaluación (preguntas, ejercicios, simulaciones, rúbricas). Sub-módulos internos por tipo.

**Owns (datos)**:
- `content.items` — id, tipo (question/coding/system_design/debugging/project/simulation), enunciado, metadatos (skill_id, nivel, dificultad, tags), versión, estado (draft/validated/deprecated)
- `content.rubrics` — item_id, criterios[], pesos, umbrales
- `content.simulation_scripts` — simulation_id, prompts LLM, flujo socrático *(fuera de esta iteración)*
- `content.assets` — archivos adjuntos (S3/bucket)

**APIs internas (REST)**:
```
# Banco de preguntas
GET    /questions?skill_id=&level=&difficulty=
POST   /questions
PUT    /questions/{id}
POST   /questions/{id}/validate     # Experto aprueba

# Tutor socrático (fuera de esta iteración)
GET    /simulations?skill_id=&level=
POST   /simulations
GET    /simulations/{id}/prompt     # Prompt LLM para sesión

# Ejercicios técnicos
GET    /exercises?type=coding|system_design|debugging|project&skill_id=&level=
POST   /exercises
PUT    /exercises/{id}
GET    /exercises/{id}/tests        # Tests unitarios para auto-eval
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `ItemCreated` | `item_id, type, skill_id, level, version` |
| `ItemValidated` | `item_id, validator_id, timestamp` |
| `ItemDeprecated` | `item_id, reason, replaced_by` |
| `RubricPublished` | `item_id, rubric_version` |

**Consumidores**: Constructor de Evaluaciones (backend; busca items), Ejecución (entrega items)

---

## 3. Constructor de Evaluaciones

**Responsabilidad**: Componer evaluaciones completas — seleccionar skills, elegir items, definir pesos, timer, orden. Backend REST. Su interfaz vive en el **Portal de Gestión** (SPA), que solo llama al Constructor; este consulta a Catálogo SFIA, Generación de Contenido y Analítica.

**Owns (datos)**:
- `builder.evaluations` — skills, items, pesos, timer, orden, estado (draft/published), `share_token`
- `builder.templates` — plantillas de evaluación

**Flujo**:
1. El portal pide al Constructor skills y niveles (que los toma de Catálogo SFIA)
2. Busca items disponibles (que el Constructor toma de Generación de Contenido)
3. Arrastra/edita: orden, peso, timer por item
4. Guarda como **plantilla** o **publica evaluación**
5. Al publicar se genera un link con `share_token`
6. Los reportes se piden al Constructor, que consulta Analítica

**API (REST)**:
```
POST   /evaluations                  # Crear evaluación
PUT    /evaluations/{id}             # Editar
POST   /evaluations/{id}/publish     # Publicar → link con share_token
GET    /evaluations/{id}/reports     # Consulta Analítica
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `EvaluationComposed` | `evaluation_id, name, skills[], items[], config{weights, timer, order}, status: draft|published` |
| `TemplatePublished` | `template_id, name, evaluation_config` |

**Consumidores**: Ejecución de Evaluaciones (lee `builder.evaluations` por SQL, solo lectura, al entrar por link)

---

## 4. Ejecución de Evaluaciones

**Responsabilidad**: Runtime de la evaluación — sesiones, timer real-time, entrega secuencial de items, captura de respuestas crudas.

**Owns (datos)**:
- `execution.sessions` — id, evaluation_id, candidate_id, org_id, status (in_progress/completed/abandoned), started_at, finished_at
- `execution.attempts` — session_id, item_id, order, started_at, submitted_at, time_spent_ms
- `execution.responses` — attempt_id, payload (código, texto, archivos, clicks), raw_answer

**Lee (solo lectura)**: `builder.evaluations`, mediante un rol de BD con SELECT únicamente. `execution.sessions.evaluation_id` es una referencia lógica, sin FK entre schemas.

**API (REST + WebSocket)**:
```
REST:
POST   /sessions                    # Iniciar sesión con {share_token} → {session_id, first_item}
GET    /sessions/{id}               # Estado sesión
GET    /sessions/{id}/next-item     # Siguiente item (o null si terminó)
POST   /responses                   # Enviar respuesta {session_id, item_id, payload}
POST   /sessions/{id}/finish        # Finalizar anticipadamente
GET    /sessions/{id}/results       # Redirige a Evaluación Automática

WebSocket (ws://exec/sessions/{id}):
Server → Client: {type: "timer_tick", remaining_ms}
Server → Client: {type: "next_item", item}
Client → Server: {type: "submit_response", item_id, payload}
```

**Eventos que emite** (tabla `events`):
| Evento | Payload clave |
|---|---|
| `SessionStarted` | `session_id, evaluation_id, candidate_id, org_id, started_at` |
| `ResponseSubmitted` | `session_id, attempt_id, item_id, time_spent_ms` |
| `SessionCompleted` | `session_id, completed_at, items_answered` |
| `SessionAbandoned` | `session_id, abandoned_at, last_item` |

**Consumidores**: Evaluación Automática (corrige), Analítica (métricas)

---

## 5. Evaluación Automática

**Responsabilidad**: Corrección asíncrona por categoría. No cubre todo — tiene límites definidos.

**Owns (datos)**:
- `evaluation.results` — session_id, item_id, score (0-1), verdict (pass/fail/partial), feedback, details (JSON), evaluated_at
- `evaluation.aggregate_scores` — session_id, skill_scores{}, overall_score, percentile, evaluated_at

**Estrategias por tipo**:
| Tipo | Método |
|---|---|
| Preguntas cerradas (MCQ, true/false) | Comparación exacta — sync |
| Coding challenges | Tests unitarios en contenedor aislado — async worker |
| System design / Debugging / Proyectos | LLM-as-judge con rúbrica (prompt estructurado) — async |
| Tutor socrático *(fuera de esta iteración)* | LLM evalúa trayectoria + rúbrica conversacional — async |

**API (REST)**:
```
GET    /evaluations/{sessionId}/result        # Resultado agregado
GET    /evaluations/{sessionId}/items/{itemId} # Detalle por item
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `EvaluationScored` | `session_id, overall_score, skill_scores{}, percentile` |
| `EvaluationFailed` | `session_id, item_id, error, retryable` |

**Consumidores**: Analítica (dashboards), Ejecución (muestra resultado al usuario)

---

## 6. Analítica y Reportes

**Responsabilidad**: Event store consumer, vistas materializadas, dashboards live, export, benchmarking.

**Owns (datos)**:
- `analytics.events` — **tabla central append-only** (event store)
- `analytics.mv_candidate_progress` — vista materializada: candidato × skill × tiempo → score, trend
- `analytics.mv_org_benchmarks` — vista materializada: org/industria × skill → percentiles
- `analytics.mv_evaluation_quality` — vista materializada: evaluación → reliability, discrimination index

**API (REST + WebSocket)**:
```
REST:
GET    /analytics/candidate/{id}           # Radar skills, evolución temporal, gaps
GET    /analytics/org/{id}                 # Benchmark postulantes, comparativa
GET    /analytics/evaluation/{id}          # Estadísticas items, fiabilidad
GET    /analytics/export?format=csv|pdf    # Reportes

WebSocket (ws://analytics/live):
Server → Client: {type: "metric_update", metric, value}  # Dashboards live
```

**Eventos que consume**: **Todos** (`SessionStarted`, `ResponseSubmitted`, `SessionCompleted`, `EvaluationScored`, `UserRegistered`, `OrgCreated`, `ItemValidated`, etc.)

**No emite eventos** (sink final).

---

## 7. Identidad y Acceso

**Responsabilidad**: AuthN/AuthZ, organizaciones/workspaces, roles, membresías, tokens JWT. Base para multi-tenancy.

**Owns (datos)**:
- `identity.users` — id, email, name, avatar, google_id, created_at
- `identity.orgs` — id, name, slug, plan, settings, created_at
- `identity.memberships` — user_id, org_id, role (admin/recruiter/teacher/student/candidate/viewer), joined_at
- `identity.tokens` — refresh tokens, access tokens (JWT con claims: org_id, roles, exp)

**API (REST + OAuth2/OIDC)**:
```
Auth:
POST   /auth/google                      # Inicio OIDC Google → redirect
GET    /auth/callback                    # Callback Google → JWT
POST   /auth/refresh                     # Refresh token
POST   /auth/logout

Orgs:
GET    /orgs                             # Mis organizaciones
POST   /orgs                             # Crear org
GET    /orgs/{id}/members                # Listar miembros
POST   /orgs/{id}/invitations            # Invitar usuario
PUT    /orgs/{id}/members/{user_id}      # Cambiar rol
DELETE /orgs/{id}/members/{user_id}      # Expulsar
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `UserRegistered` | `user_id, email, google_id` |
| `OrgCreated` | `org_id, name, owner_id` |
| `MembershipChanged` | `user_id, org_id, old_role, new_role` |
| `RoleAssigned` | `user_id, org_id, role` |

**Consumidores**: Todos (validan JWT localmente; suscriben a eventos para cache de permisos)

---

## Base de Datos Compartida (PostgreSQL)

```
PostgreSQL (instancia única)
├── schema sfia          # Catálogo SFIA
├── schema content       # Generación de Contenido
├── schema builder       # Constructor de Evaluaciones
├── schema execution     # Ejecución de Evaluaciones
├── schema evaluation    # Evaluación Automática
├── schema analytics     # Analítica (vistas materializadas)
├── schema identity      # Identidad y Acceso
└── schema public
    └── events           # Tabla central append-only (event store)
        # columnas: id, type, aggregate_id, payload(jsonb), metadata, created_at
```

**Patrón de eventos**:
- Productores: `INSERT INTO events (type, aggregate_id, payload) VALUES ...`
- Excepción de lectura entre schemas: Ejecución lee `builder.evaluations` (solo SELECT)
- Consumidor Analítica: `SELECT * FROM events WHERE id > last_processed ORDER BY id` (polling) o CDC (Debezium)

---

## Sistemas Externos

| Sistema | Integración |
|---|---|
| **Google (OIDC)** | Login de usuarios (OAuth2/OpenID Connect) |
| **SFIA Reference** | Carga inicial taxonomía oficial (import periódico) |
| **Proveedor de LLM** | API de modelo de lenguaje (genérico, por definir). La usan Generación de Contenido (borradores de ítems y rúbricas) y Evaluación Automática (LLM-as-judge) |

GitHub no es un sistema externo del producto: se usa solo como repositorio y CI/CD del desarrollo de la tesis (ver `docs/thesis/objectives.md`). La integración de repos/PRs para ejercicios tipo proyecto queda fuera de la primera versión.

---

## Resumen de Comunicación

Ver `figures/fig-01-c4-containers.png`.

- Portal de Gestión → Constructor (REST). Portal del Postulante → Ejecución y Analítica (REST + WebSocket).
- Ambos portales → Identidad → Google (login OIDC).
- Constructor → Catálogo SFIA, Generación de Contenido y Analítica (REST).
- Ejecución → `builder.evaluations` (SQL, solo lectura).
- Generación de Contenido y Evaluación Automática → Proveedor de LLM (API).
- Ejecución → Evaluación Automática, y todos los módulos → Analítica (eventos en `public.events`).

---

## Próximos Pasos

1. **Diagrama C4 Nivel 3 (Componentes)** — desglosar cada contenedor en componentes internos
2. **Definir payloads exactos de eventos** (JSON Schema)
3. **Estrategia de migración/esquema** por módulo
4. **Tech stack por módulo** (polyglot: Node/Go para APIs, Python para Workers IA, React/Vue para los portales (SPA))
5. **Definir multi-tenancy** (row-level security en PostgreSQL por `org_id`)
6. **MVP scope** para tesis