# Visión del Proyecto de Tesis

**Título tentativo:** Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA

---

## Acuerdos establecidos

### Alcance (MVP por definir luego)
- Primero definimos visión completa, después scope de tesis

### Rol de SFIA
- **Taxonomía base**: Skills con niveles de responsabilidad (1-7)
- **Perfiles de roles predefinidos**: Usar SFIA role profiles estándar como plantillas

### Generación de contenidos
- **IA genera borradores** + **expertos validan** (modelo híbrido)

### Tutor socrático
- **Chat interactivo (LLM)**: Diálogo guiado con pistas, preguntas dirigidas, feedback en tiempo real

### Tipos de ejercicios (must-have)
- Coding challenges (algoritmos, ED, complejidad)
- System design / arquitectura
- Debugging / code review
- Proyectos prácticos (take-home mini-proyectos)
- Banco diverso mapeado a skills SFIA

### Composición de evaluaciones
- **Mixto**: Plantillas de perfiles SFIA + editor visual para personalizar (drag-and-drop, pesos, orden, tiempo)

### Evaluación de ejercicios abiertos
- **Por categoría de método**: Definir estrategias de revisión según tipo (banco preguntas, test técnico, system design, debugging, proyecto)
- Pendiente: categorizar métodos y asignar estrategia (rúbricas+LLM, tests auto, peer review, híbrido)

### Analytics / Reportes
- **Todo**: Score final + desglose por skill SFIA (radar, gaps) + proceso completo (tiempo, intentos, patrones, keystrokes) + benchmarking vs población (percentiles, comparativa industria)

### Modos práctica vs evaluación
- **Unificado**: Todo es práctica hasta que se marca como oficial (el reclutador decide qué cuenta)

### Multi-tenancy
- **Pendiente**: No decidido aún. Opciones: SaaS multi-tenant (workspaces), single-tenant, híbrido

### Integraciones MVP
- **Login con Google (OIDC)** en la primera versión. GitHub solo como repositorio y CI/CD del desarrollo de la tesis, no como integración del producto.
- SSO empresarial (SAML/OIDC) → Fase 2
- ATS → Fase 2

### Tech stack
- **Primero arquitectura lógica (módulos, responsabilidades, flujos)**, después stack tecnológico

---

## Estado actual

| Área | Estado |
|---|---|
| Visión general y value prop | ✅ Definida |
| User personas (4) | ✅ Definidas |
| SFIA role (taxonomía + perfiles) | ✅ Definido |
| Content generation (IA + experto) | ✅ Definido |
| Tutor socrático (chat LLM) | ✅ Definido |
| Exercise types (4 categorías) | ✅ Definido |
| Assessment composition (plantillas + editor) | ✅ Definido |
| Evaluation strategy (por categoría) | 🔄 Pendiente categorizar |
| Analytics (completo) | ✅ Definido |
| Practice vs Assessment mode | ✅ Unificado |
| Multi-tenancy | ❌ Pendiente |
| Integraciones MVP | ✅ Login con Google (OIDC) |
| Tech stack | ⏳ Tras arquitectura lógica |

---

## Próximos pasos (pendientes)

1. **Definir multi-tenancy** (workspaces vs single-tenant vs híbrido)
2. **Categorizar métodos de evaluación** y asignar estrategia por tipo
3. **Identificar módulos lógicos**, responsabilidades y contratos
4. **Diagramas**: Contexto (C4 nivel 1), Contenedores (C4 nivel 2), Flujo de datos principal
5. **Definir eventos de dominio** (integración entre módulos)
6. **Elegir tech stack** por módulo (polyglot si aplica)
7. **Definir MVP scope** para tesis

---

## Rol de la IA en este proceso

- **Facilitador arquitectónico**: pregunta, propone opciones y documenta los acuerdos
- **Experto en arquitectura**: traduce requisitos a módulos, contratos y patrones
- **Mantiene** `vision.md` como *single source of truth* viva
- **No decide por el autor**: presenta trade-offs y el autor elige

---

## Identificación de módulos lógicos (en progreso)

### Módulos propuestos

| Módulo | Responsabilidad principal | Sub-módulos / Notas |
|---|---|---|
| **Generación de Contenido** | Generar contenido para métodos de evaluación | • Banco de preguntas<br>• Tutor socrático (chat LLM)<br>• Ejercicios técnicos (coding, system design, debugging, proyectos)<br>• Interactúa constantemente con **Catálogo SFIA** |
| **Catálogo SFIA** | Taxonomía SFIA: skills, niveles, perfiles de rol, mapeo skill↔contenido | Catálogo versionado, validación experto, perfiles predefinidos |
| **Constructor de Evaluaciones** | Componer evaluaciones: seleccionar skills, editar preguntas, orden, timer, pesos | Plantillas de perfiles SFIA + editor visual (drag-and-drop) |
| **Ejecución de Evaluaciones** | Ejecutar evaluación: entregar preguntas una a una, timer, sesión, respuestas | Modo unificado (práctica/oficial), persistencia de intento |
| **Evaluación Automática** | Corrección automática con límites definidos | Por categoría: tests unitarios, LLM-as-judge con rúbricas, heurísticas; **no cubre todo** |
| **Analítica y Reportes** | Comparar postulantes, evolución temporal, radar skills, gaps, benchmarking | Event store, agregaciones, export, percentiles vs población |
| **Identidad y Acceso** | AuthN/AuthZ, orgs/workspaces, roles, membresías, invitaciones, SSO futuro | Base para multi-tenancy |

---

### Contratos, eventos y ownership por módulo

| Módulo | Owns (datos) | Expone (API) | Emite (eventos) | Consume (eventos) |
|---|---|---|---|---|
| **Catálogo SFIA** | Skills, niveles, perfiles, mapeos skill↔contenido | REST CRUD + queries (skills por nivel, perfiles con skills) | `SkillCreated`, `SkillUpdated`, `ProfileCreated`, `ProfileUpdated`, `MappingChanged` | — |
| **Generación de Contenido** | Items (preguntas, ejercicios, simulaciones), rúbricas, versionado, estado validación | APIs internas por sub-módulo: banco, tutor, ejercicios (CRUD + búsqueda por skill/nivel/tipo) | `ItemCreated`, `ItemValidated`, `ItemDeprecated`, `RubricPublished` | `SkillCreated`, `ProfileUpdated` (para mapear items) |
| **Constructor de Evaluaciones** | Plantillas y evaluaciones compuestas (schema `builder`; incluye `share_token`) | REST: composición, plantillas, publicar y link compartible; consulta Catálogo, Generación y Analítica desde su backend | `EvaluationComposed`, `TemplatePublished` | `ItemValidated`, `ProfileUpdated` |
| **Ejecución de Evaluaciones** | Sesiones, intentos, respuestas crudas, timer, estado | REST: `POST /sessions`, `GET /sessions/{id}/next-item`, `POST /responses`, `POST /sessions/{id}/finish`, `GET /sessions/{id}` | `SessionStarted`, `ResponseSubmitted`, `SessionCompleted`, `SessionAbandoned` | — (lee `builder.evaluations` por SQL, solo lectura) |
| **Evaluación Automática** | Resultados, scores, feedback, verdicts | REST: `GET /evaluations/{sessionId}/result` | `EvaluationScored`, `EvaluationFailed` | `SessionCompleted`, `ResponseSubmitted` |
| **Analítica y Reportes** | Event store (append-only), vistas materializadas, dashboards | REST: `GET /analytics/{candidate\|org\|evaluation}`, WebSocket live dashboards | — | **Todos**: `SessionStarted`, `ResponseSubmitted`, `SessionCompleted`, `EvaluationScored`, `UserRegistered`, `OrgCreated`, etc. |
| **Identidad y Acceso** | Usuarios, orgs/workspaces, membresías, roles, tokens | REST: auth (login con Google OIDC, refresh, logout), CRUD orgs, membresías, roles | `UserRegistered`, `OrgCreated`, `MembershipChanged`, `RoleAssigned` | — |

*Próximo: diagramas C4 (contexto, contenedores), eventos de dominio detallados, tech stack por módulo*