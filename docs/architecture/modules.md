# Arquitectura - Módulos Lógicos

Plataforma de evaluación técnica y práctica para ingeniería de software basada en SFIA.

---

## 1. Catálogo SFIA

**Responsabilidad**: Fuente de verdad de la taxonomía SFIA (skills, niveles 1-7 y perfiles de rol).

**Owns (datos)**:
- `skills` — código, nombre, descripción, categoría, subcategoría, nivel mínimo y máximo en que SFIA la define
- `levels` — nivel 1-7, descripción genérica de responsabilidad
- `role_profiles` — perfil (ej: "Software Engineer L3") con su familia y sus skills (marcando las primarias)

**API (REST)**:
```
GET    /skills                    # Lista skills con filtros (categoría, nivel)
GET    /skills/{id}               # Detalle skill + niveles
GET    /role-profiles             # Perfiles predefinidos
GET    /role-profiles/{id}        # Skills de un perfil
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

**Consumidores**: Generación de Contenido, Constructor de Evaluaciones (backend)

---

## 2. Generación de Contenido

**Responsabilidad**: Crear, versionar y validar items de evaluación (preguntas, ejercicios, rúbricas). Sub-módulos internos por tipo. Su interfaz vive en el **Portal de Contenido** (SPA), que solo llama a Generación de Contenido; este consulta a Catálogo SFIA.

**Owns (datos)**:
- `generation_requests` — pedido de generación o de regeneración: skill, nivel, tipo, cantidad, tiempo estimado, contexto, estado
- `items` — id, estado (active/inactive), skill_id (una skill por ítem), disponibilidad para expertos (uso privado o visible para validadores)
- `item_versions` — item_id, versión, tipo, origen (generated/regenerated/edited), pedido de generación, nivel, tiempo estimado, objetivo de evaluación, enunciado
- Una tabla por tipo, con una fila por versión: `item_choice_options` (alternativa única), `item_true_false`, `item_open_question`, `item_coding`, `item_system_design`, `item_debugging` e `item_findings`
- `rubric_criteria`, `rubric_levels` — rúbrica de cada versión, solo en los tipos abiertos (pregunta de desarrollo, system design, debugging)
- `item_scores` — item_version_id, validator_id, puntuación (0.0 a 5.0)
- `assets` — archivos adjuntos (S3/bucket)

**APIs internas (REST)**:
```
# Generación
POST   /drafts                      # Generar borradores (no se guardan): skill, nivel, tipo, cantidad, tiempo y contexto; también regenera un borrador con comentario
POST   /items/publish               # Publicar los borradores revisados: versión 1, activos y sin puntuar; elige si quedan disponibles para expertos
POST   /items/{id}/regenerate       # Regenerar con un nuevo contexto (puede cambiar el tipo) → nueva versión

# Banco de ítems
GET    /items?status=active&skill_id=&role_profile_id=&type=&score=   # Filtrar (activos por defecto)
GET    /items/{id}                  # Versión vigente: atributos, datos del tipo, rúbrica, promedio y cantidad de puntuaciones
PUT    /items/{id}                  # Modificar manualmente → nueva versión
PUT    /items/{id}/status           # Activar o desactivar
POST   /item-versions/{id}/scores   # Experto validador puntúa de 0.0 a 5.0 (rol `validator`)
GET    /items/{id}/tests            # Tests unitarios (coding) para auto-eval
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `ItemVersionCreated` | `item_id, version, type, origin, skill_id, level` |
| `ItemScored` | `item_id, version, validator_id, score, timestamp` |
| `ItemDeactivated` | `item_id, reason, replaced_by` |

**Consumidores**: Constructor de Evaluaciones (backend; busca items), Ejecución (entrega items)

---

## 3. Constructor de Evaluaciones

**Responsabilidad**: Componer evaluaciones completas — seleccionar skills, elegir items, definir pesos, timer, orden. Backend REST. Su interfaz vive en el **Portal de Gestión** (SPA), que solo llama al Constructor; este consulta a Catálogo SFIA, Generación de Contenido y Analítica.

**Owns (datos)**:
- `evaluations` — skills, ítems (por `item_version_id`), pesos, timer, orden, estado (draft/published), `share_token`
- `templates` — plantillas de evaluación

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

**Consumidores**: Ejecución de Evaluaciones (lee `evaluations` por SQL, solo lectura, al entrar por link; el esquema de acceso está por decidirse)

---

## 4. Ejecución de Evaluaciones

**Responsabilidad**: Runtime de la evaluación — sesiones, timer real-time, entrega secuencial de items, captura de respuestas crudas.

**Owns (datos)**:
- `sessions` — id, evaluation_id, candidate_id, org_id, status (in_progress/completed/abandoned), started_at, finished_at
- `attempts` — session_id, item_version_id, order, started_at, submitted_at, time_spent_ms
- `responses` — attempt_id, payload (código, texto, archivos, clicks), raw_answer

**Lee (solo lectura)**: `evaluations`. La forma de acceso (rol de BD, schemas) está por decidirse. `sessions.evaluation_id` es una referencia lógica.

**API (REST + WebSocket)**:
```
REST:
POST   /sessions                    # Iniciar sesión con {share_token} → {session_id, first_item}
GET    /sessions/{id}               # Estado sesión
GET    /sessions/{id}/next-item     # Siguiente item (o null si terminó)
POST   /responses                   # Enviar respuesta {session_id, item_version_id, payload}
POST   /sessions/{id}/finish        # Finalizar anticipadamente
GET    /sessions/{id}/results       # Redirige a Evaluación Automática

WebSocket (ws://exec/sessions/{id}):
Server → Client: {type: "timer_tick", remaining_ms}
Server → Client: {type: "next_item", item}
Client → Server: {type: "submit_response", item_version_id, payload}
```

**Eventos que emite** (tabla `events`):
| Evento | Payload clave |
|---|---|
| `SessionStarted` | `session_id, evaluation_id, candidate_id, org_id, started_at` |
| `ResponseSubmitted` | `session_id, attempt_id, item_version_id, time_spent_ms` |
| `SessionCompleted` | `session_id, completed_at, items_answered` |
| `SessionAbandoned` | `session_id, abandoned_at, last_item` |

**Consumidores**: Evaluación Automática (corrige), Analítica (métricas)

---

## 5. Evaluación Automática

**Responsabilidad**: Corrección asíncrona por categoría. No cubre todo — tiene límites definidos.

**Owns (datos)**:
- `results` — session_id, item_version_id, score (0-1), verdict (pass/fail/partial), feedback, details (JSON), evaluated_at
- `aggregate_scores` — session_id, skill_scores{}, overall_score, percentile, evaluated_at

**Estrategias por tipo**:
| Tipo | Método |
|---|---|
| Alternativa única y verdadero/falso | Comparación exacta — sync |
| Coding challenges | Tests unitarios en contenedor aislado — async worker |
| Pregunta de desarrollo / System design / Debugging | LLM-as-judge con rúbrica (prompt estructurado) — async |

**API (REST)**:
```
GET    /evaluations/{sessionId}/result        # Resultado agregado
GET    /evaluations/{sessionId}/items/{itemVersionId} # Detalle por item
```

**Eventos que emite**:
| Evento | Payload clave |
|---|---|
| `EvaluationScored` | `session_id, overall_score, skill_scores{}, percentile` |
| `EvaluationFailed` | `session_id, item_version_id, error, retryable` |

**Consumidores**: Analítica (dashboards), Ejecución (muestra resultado al usuario)

---

## 6. Analítica y Reportes

**Responsabilidad**: Event store consumer, vistas materializadas, dashboards live, export, benchmarking.

**Owns (datos)**:
- `events` — **tabla central append-only** (event store)
- `mv_candidate_progress` — vista materializada: candidato × skill × tiempo → score, trend
- `mv_org_benchmarks` — vista materializada: org/industria × skill → percentiles
- `mv_evaluation_quality` — vista materializada: evaluación → reliability, discrimination index

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

**Eventos que consume**: **Todos** (`SessionStarted`, `ResponseSubmitted`, `SessionCompleted`, `EvaluationScored`, `UserRegistered`, `OrgCreated`, `ItemScored`, etc.)

**No emite eventos** (sink final).

---

## 7. Identidad y Acceso

**Responsabilidad**: AuthN/AuthZ, organizaciones/workspaces, roles, membresías, tokens JWT. Base para multi-tenancy.

**Owns (datos)**:
- `users` — id, email, name, avatar, google_id, created_at
- `orgs` — id, name, slug, plan, settings, created_at
- `memberships` — user_id, org_id, role (admin/recruiter/teacher/student/candidate/validator/viewer), joined_at
- `refresh_tokens` — tokens de refresco: opacos, se guardan con hash, duran 7 días y sirven una sola vez (cada renovación entrega uno nuevo). Los access tokens son JWT de 1 hora con claims: org_id, roles, exp
- `user_roles` — user_id, role. En el Sprint 1 reemplaza a `orgs` y `memberships` mientras la multi-tenancy esté pendiente

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

PostgreSQL (instancia única) con **un schema por módulo**. Para el Sprint 1 están definidos `identity` (Identidad y Acceso), `catalog` (Catálogo SFIA), `content` (Generación de Contenido) y `events` (event store). Los schemas de los demás módulos se definen cuando se aborden.

Las FK entre schemas son físicas: `content` depende de `catalog` (`skill_id`, `level`) y de `identity` (`created_by`, `requested_by`, `validator_id`); `catalog` e `identity` no dependen de nadie. El detalle está en `sprint1-db.dbml`, `item-types-dictionary.md` y la Figura 3.

**Pendiente de decisión:** qué rol de BD accede a cada schema y de qué forma (por ejemplo, la lectura de `evaluations` desde Ejecución).

**Patrón de eventos:**
- Productores: `INSERT INTO events.events (type, aggregate_id, payload) VALUES ...`
- Consumidor Analítica: `SELECT * FROM events.events WHERE id > last_processed ORDER BY id` (polling) o CDC (Debezium)

---

## Sistemas Externos

| Sistema | Integración |
|---|---|
| **Google (OIDC)** | Login de usuarios (OAuth2/OpenID Connect) |
| **SFIA Reference** | Carga inicial taxonomía oficial (import periódico) |
| **Proveedor de LLM** | API de modelo de lenguaje. En el Sprint 1 es Groq, a través del módulo `llm` (la CLI `claude -p` queda como alternativa). La usan Generación de Contenido (borradores de ítems y rúbricas) y Evaluación Automática (LLM-as-judge) |

GitHub no es un sistema externo del producto: se usa solo como repositorio y CI/CD del desarrollo de la tesis (ver `docs/thesis/objectives.md`). La integración de repos/PRs para ejercicios tipo proyecto queda fuera de la primera versión.

---

## Resumen de Comunicación

Ver `figures/fig-01-c4-containers.png`.

- Portal de Contenido → Generación de Contenido (REST). Portal de Gestión → Constructor (REST). Portal del Postulante → Ejecución y Analítica (REST + WebSocket).
- Los tres portales → Identidad → Google (login OIDC).
- Constructor → Catálogo SFIA, Generación de Contenido y Analítica (REST). Generación de Contenido → Catálogo SFIA (REST).
- Ejecución → `evaluations` (SQL, solo lectura).
- Generación de Contenido y Evaluación Automática → Proveedor de LLM (API).
- Ejecución → Evaluación Automática, y todos los módulos → Analítica (eventos en `events`).

---

## Próximos Pasos

1. **Diagrama C4 Nivel 3 (Componentes)** — desglosar cada contenedor en componentes internos
2. **Definir payloads exactos de eventos** (JSON Schema)
3. **Estrategia de migración/esquema** por módulo
4. **Tech stack por módulo** (polyglot: Node/Go para APIs, Python para Workers IA, React/Vue para los portales (SPA))
5. **Definir multi-tenancy** (row-level security en PostgreSQL por `org_id`)
6. **MVP scope** para tesis