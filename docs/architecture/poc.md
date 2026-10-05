# Pruebas de concepto (PoC)

Plataforma de evaluación técnica y práctica para ingeniería de software basada en SFIA.

---

## 1. Propósito

Probar distintas tecnologías y las conexiones entre ellas, para decidir el stack tecnológico con evidencia (OE2: "Selección del stack tecnológico por módulo"). La PoC no es una versión reducida del producto: valida tecnologías y conexiones, no funcionalidad de negocio.

## 2. Alcance

**Dentro:**
- Frontend, backend, base de datos, autenticación con Google y llamada a un LLM.
- Las conexiones entre ellos: frontend ↔ backend, frontend ↔ autenticación, backend ↔ base de datos, backend ↔ LLM.

**Fuera:** Constructor visual, `share_token`, Ejecución, Evaluación Automática, Catálogo SFIA, Analítica, eventos (`public.events`), roles y organizaciones, y el tutor socrático.

## 3. Principio de diseño: módulos intercambiables

Cada módulo de PoC es independiente y puede cubrir más de un contenedor del C4. Los módulos se comunican solo por contratos (HTTP/REST, JWT, SQL). Así, cada módulo puede tener más de una implementación y cambiarse sin tocar los demás.

| Módulo PoC | Contenedores C4 que representa |
|---|---|
| Frontend | Portal de Gestión y Portal del Postulante |
| Backend | Constructor de Evaluaciones y Generación de Contenido (como API) |
| Autenticación | Identidad y Acceso, y el sistema externo Google (OIDC) |
| LLM | Proveedor de LLM, usado por Generación de Contenido |
| Base de datos | PostgreSQL |

## 4. Módulos y candidatos

| Módulo | Responsabilidad | Candidatos |
|---|---|---|
| Frontend | SPA con tres secciones: tabla con datos de la BD, formulario que escribe en la BD y consulta a la IA | React, Vue |
| Backend | API REST: `GET /items`, `POST /items`, `POST /ai/ask`. Valida el JWT en cada llamada y registra al usuario en `users` (por `google_id`) la primera vez que lo ve | Python/FastAPI, Node.js |
| Autenticación | Login con Google (OIDC) y emisión del JWT. Servicio Python independiente | Authlib (flujo en el backend), google-auth (botón de Google en el frontend, verificación del token en el backend) |
| LLM | `ask(prompt) → texto`. Lanza la CLI `claude -p` como subproceso. El comando es configurable para usar otros modelos. Servicio Python independiente | Una implementación (Python) |
| Base de datos | PostgreSQL con las tablas `users` e `items` Acceso con **ORM**: SQLAlchemy (con FastAPI). Acceso con **SQL directo**: psycopg (con FastAPI), pg (con Node) |

### Datos

- `users`: `id`, `email`, `nombre`, `google_id`, `creado_en`.
- `items`: `id`, `titulo`, `descripcion`, `creado_por`, `creado_en`.

## 5. Conexiones y contratos

| Conexión | Contrato |
|---|---|
| Frontend ↔ Autenticación | Redirección o botón de Google; el módulo devuelve un JWT firmado con HS256 (secreto compartido con el backend) |
| Frontend ↔ Backend | REST con el JWT en el encabezado `Authorization` |
| Backend ↔ Base de datos | SQL, mediante un ORM o con consultas directas |
| Backend ↔ LLM | HTTP al servicio LLM (`POST /ask`) |
| Cualquier módulo ↔ prueba de humo | `GET /health` sin token: devuelve `modulo`, `variante` y `versiones`, para identificar qué implementación se prueba |

## 6. Flujo de prueba

1. El usuario inicia sesión con Google (Autenticación) y recibe un JWT.
2. El frontend muestra la tabla de `items` (`GET /items`).
3. El usuario envía el formulario y se crea un `item` (`POST /items`).
4. El usuario escribe una consulta y recibe la respuesta de la IA (`POST /ai/ask`). No se guarda historial.

## 7. Combinaciones a probar

Al ser intercambiables, se prueba cada implementación contra las demás fijas:

- Frontend: React o Vue, contra el mismo backend.
- Backend: FastAPI o Node, con el mismo frontend, la misma BD y los mismos servicios.
- Autenticación: Authlib o google-auth, con el mismo frontend y backend.
- Acceso a datos: ORM o SQL directo, con el mismo frontend, backend y BD.

## 8. Limitaciones conocidas

- El módulo LLM usa la sesión de la CLI `claude` instalada en la máquina local. Sirve para la PoC, no para un despliegue. Cada consulta levanta un proceso y tarda varios segundos.
- El módulo LLM debe pasar el prompt sin `shell=True` (o por stdin) y con un timeout.
- Los resultados de esta PoC no reflejan cómo se conectará el producto final al LLM.
- La PoC concentra el acceso a la BD en el backend. Esto difiere de la arquitectura original (un schema por módulo) y no valida schemas ni roles de BD por módulo.

## 9. Ejecución

Todo corre en local, sin contenedores: es una prueba de concepto. Cada rol tiene un puerto fijo y cualquier implementación del rol lo ocupa, de modo que se puede cambiar una sin tocar las demás.

| Módulo | Ejecución | Puerto |
|---|---|---|
| Frontend | `npm run dev` (Vite) | 5173 |
| Backend | `uvicorn` (FastAPI) o Node | 8000 |
| Autenticación | `uvicorn` (Python) | 8001 |
| LLM | `uvicorn` (Python), con la CLI `claude` instalada | 8002 |
| Base de datos | PostgreSQL instalado en WSL2 | 5432 |

- La configuración (puertos, URLs, claves, comando de la CLI) va en variables de entorno (`.env`).
- Un `Makefile` arranca la combinación elegida con un comando, por ejemplo `make run FRONT=vue BACK=node AUTH=authlib`.
- `bash poc/<módulo>/run.sh` levanta cada módulo Python: crea su entorno virtual y su `.env` si faltan, instala las dependencias si cambiaron y arranca `uvicorn`.
- Se anotan las versiones de Python, Node y PostgreSQL usadas en cada resultado, porque el entorno no es reproducible.
- `python3 poc/smoke_test.py` ejecuta una prueba de humo del backend y del LLM, e imprime la variante y las versiones de cada módulo (`--sin-llm` omite las llamadas a la CLI).

## 10. Pendiente

- Criterios de comparación de cada módulo (esfuerzo, rendimiento, mantenibilidad u otros).
- Estructura interna de cada módulo.
