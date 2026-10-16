# Figura 1 — Diagrama de contenedores (C4 nivel 2)

**Archivos:** `fig-01-c4-containers.html` (fuente) · `fig-01-c4-containers.png` (render, 3860×2220 px)

**Fuente de contenido:** `../modules.md`

## Propósito

Mostrar los contenedores desplegables de la plataforma de evaluación técnica basada en SFIA, cómo se relacionan con los actores y sistemas externos, y cómo se comunican entre sí: por API hacia el usuario y por eventos a través de la base de datos.

## Elementos

### Personas
| Actor | Rol |
|---|---|
| Experto validador | Revisa y aprueba los ítems generados |
| Reclutador / Empresa | Crea y comparte evaluaciones, revisa resultados, compara candidatos |
| Docente / Investigador | Crea y comparte evaluaciones, analiza alineación currículo-industria |
| Estudiante | Practica y rinde evaluaciones para aprender y medir su avance |
| Postulante | Rinde evaluaciones técnicas en procesos de selección |

Reclutador y Docente usan el Portal de Gestión y el Portal de Contenido; el Experto validador, solo el Portal de Contenido; Estudiante y Postulante, el Portal del Postulante. Ambos acceden por HTTPS.

### Sistemas externos
| Sistema | Integración |
|---|---|
| SFIA Reference | Importación y sincronización periódica de la taxonomía, hacia Catálogo SFIA |
| Google (OIDC) | Login de usuarios (Identidad y Acceso) vía OAuth2 / OpenID Connect |
| Proveedor de LLM | API de un modelo de lenguaje (proveedor genérico, por definir). La usan Generación de Contenido (borradores de ítems y rúbricas) y Evaluación Automática (LLM-as-judge) |

### Contenedores
| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Portal de Contenido | SPA (React/Vue) | Generar, editar y validar ítems con IA. Solo llama a Generación de Contenido (y a Identidad para el login). Sin persistencia propia |
| Portal de Gestión | SPA (React/Vue) | Interfaz del Constructor visual y de los reportes. Solo llama al Constructor (y a Identidad para el login). Sin persistencia propia |
| Portal del Postulante | SPA (React/Vue) | Rendir y practicar evaluaciones; ver resultados y progreso propios. Sin persistencia propia |
| Constructor de Evaluaciones | REST API | Compone evaluaciones y plantillas; al publicar genera un link compartible. Consulta Catálogo, Generación y Analítica |
| Catálogo SFIA | REST API | Skills, niveles 1-7, perfiles de rol y mapeos skill ↔ item |
| Generación de Contenido | REST API + Workers IA (Python) | Banco de preguntas y ejercicios técnicos con generación asistida por IA; versionado y validación por experto. Consulta Catálogo SFIA |
| Identidad y Acceso | OAuth2 / OIDC | Login con Google (OIDC), organizaciones, roles, tokens JWT, base de multi-tenancy |
| Analítica y Reportes | REST API + WebSocket | Consume todos los eventos; vistas materializadas, dashboards live, export |
| Evaluación Automática | Async Workers (Python) | Corrección por tipo: MCQ, tests unitarios en sandbox, LLM-as-judge con rúbrica |
| Ejecución de Evaluaciones | REST API + WebSocket | Sesiones, timer real-time, entrega secuencial de items, respuestas crudas |

### Base de datos
PostgreSQL en una única instancia. Los schemas, y qué módulos acceden a cuáles y de qué forma, están por decidirse.

## Relaciones (leyenda de flechas)

| Estilo | Significado |
|---|---|
| Azul, doble punta | Acceso SQL de cada contenedor a la base de datos |
| Naranja | Eventos a través de la BD. Escriben: Catálogo, Generación, Identidad y Ejecución. Lee: Analítica (todos los eventos). Lee y escribe: Evaluación Automática (consume `SessionCompleted`, emite `EvaluationScored` / `EvaluationFailed`) |
| Negro | Actor → portal y portal → contenedor. Portal de Contenido → Generación; Portal de Gestión → Constructor; Portal del Postulante → Ejecución y Analítica; los tres portales → Identidad (login) |
| Turquesa | REST entre contenedores: Constructor → Catálogo, Generación y Analítica; Generación → Catálogo |
| Morado discontinuo | Integración con sistemas externos |

Los portales no se comunican con Evaluación Automática: los resultados llegan al usuario a través de Ejecución y Analítica.

## Cómo regenerar el PNG

Desde Windows con Edge instalado:

```
msedge --headless --hide-scrollbars --force-device-scale-factor=2 --window-size=1930,1110 --screenshot=fig-01-c4-containers.png file:///<ruta>/fig-01-c4-containers.html
```

## Pendiente de decisión (afecta a esta figura)

- Tecnologías definitivas por contenedor (hoy "Node/Go/Python" sin fijar).
- Proveedor de LLM concreto (hoy genérico).
- Tutor socrático: fuera de esta iteración, no aparece en esta figura.
- Organización final de los frontends (hoy tres portales: Contenido, Gestión y Postulante).
- Quién puede abrir un link compartido (organización, grupo, anónimo).
- Schemas de la BD y acceso de cada módulo a ellos (hoy por decidirse).
- Si el MVP se implementa como monolito modular en vez de servicios separados; en ese caso esta figura pasaría a representar módulos y no despliegues.
