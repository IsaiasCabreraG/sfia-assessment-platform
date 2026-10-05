# Prueba de concepto (PoC)

Esta carpeta contiene la prueba de concepto técnica de la plataforma de evaluación técnica basada en SFIA, y esta guía
explica qué es, qué se probó y cómo ejecutarla. El diseño formal (alcance, contratos entre módulos) está en
[`../docs/architecture/poc.md`](../docs/architecture/poc.md).

## Qué es y para qué se hizo

La PoC es un **sistema mínimo** (iniciar sesión con Google, ver y guardar ítems en una base de datos, y hacer una
consulta a un modelo de lenguaje) construido **varias veces con tecnologías distintas**. No es una versión reducida del
producto: no implementa nada del negocio (SFIA, evaluaciones, corrección), solo sirve para validar tecnologías y la
forma en que se conectan entre sí.

Se hizo para **decidir el stack tecnológico con evidencia** (objetivo OE2: selección del stack por módulo), probando
alternativas reales en vez de elegirlas solo en el papel.

Para eso, cada módulo es **independiente e intercambiable**: se comunican únicamente por contratos (REST, JWT, SQL y un
`/health` que identifica la variante). Así se puede cambiar la tecnología de un módulo sin tocar los demás.

## Qué se probó

| Módulo | Alternativas probadas | Qué se validó |
|---|---|---|
| Frontend | React, Vue (TypeScript + Vite) | La misma interfaz (tabla, formulario y consulta a la IA) contra cualquier backend, y la detección automática del módulo de autenticación |
| Backend | FastAPI + psycopg (SQL directo), FastAPI + SQLAlchemy (ORM), Node + Express + TypeScript + pg (SQL directo) | El mismo contrato REST, la validación del JWT, el registro del usuario, el acceso a la BD y la llamada al LLM |
| Autenticación | Authlib (redirección), google-auth (botón de Google) | El login con Google y la emisión del JWT (HS256) |
| LLM | CLI `claude` lanzada por subproceso | Una consulta básica desde un módulo independiente, con el comando configurable |
| Base de datos | PostgreSQL | Las tablas `users` e `items`, accedidas con ORM y sin ORM |

Las conexiones que se ejercitan son: frontend ↔ backend (REST con JWT y CORS), frontend ↔ autenticación,
backend ↔ base de datos y backend ↔ LLM.

**Resultado.** Las tres variantes de backend cumplen el mismo contrato (verificado con la prueba de humo) y los dos
frontends pasan la misma prueba E2E contra él, de modo que las variantes son combinables entre sí. El login con Google
se verificó a mano con ambos módulos de autenticación. La PoC **no midió** rendimiento, tiempos ni esfuerzo de
desarrollo: no se definieron criterios de comparación.

## Hallazgos técnicos

Diferencias y problemas reales que aparecieron al construir las variantes; son material para decidir el stack.

| Área | Hallazgo | Afecta a |
|---|---|---|
| Herramientas de tipos | `vue-tsc` (la revisión de tipos de Vue) **no funciona con TypeScript 7**: falla al arrancar. El módulo Vue usa TypeScript 5.9; React y el backend Node usan la 7.0 | Vue |
| Plantillas | Las plantillas de Vue **no ven `window`** ni otros globales del navegador; `vue-tsc` lo detectó antes de ejecutar, y se resuelve con una función en el script del componente | Vue |
| Acceso a datos | Con un **ORM**, el modelo debe declarar los valores por defecto que ya define la BD (`DEFAULT now()`). Sin eso, SQLAlchemy insertó `NULL` y PostgreSQL lo rechazó. Con SQL directo no ocurre, porque la consulta simplemente no menciona esa columna | FastAPI + SQLAlchemy |
| Acceso a datos | El driver `pg` de Node devuelve los `BIGINT` como **texto**; hubo que convertirlos a número para igualar el contrato de las otras variantes. Las fechas también salen con otro formato (UTC con `Z`, frente a la zona horaria con `-03:00` de Python) | Backend Node |
| Conexiones | SQLAlchemy y el `Pool` de `pg` **reutilizan conexiones**; la variante con psycopg abre una por operación | Backends |
| Configuración | `node --env-file` trata `#` como inicio de comentario: una contraseña con `#` se leyó truncada y la BD la rechazó. Bash y `python-dotenv` la leen completa | Backend Node |
| Ejecución de TypeScript | Node 24 ejecuta `.ts` directamente (`node main.ts`), sin compilar, pero **no comprueba los tipos**: eso exige un paso aparte (`tsc --noEmit`) | Backend Node, frontends |
| Autenticación | El mismo JWT HS256 se emitió con Python (PyJWT) y se validó indistintamente con Python y con Node (`jose`), usando solo el secreto compartido | Backends, autenticación |
| Autenticación | Google dibuja su botón aunque rechace el origen y **no avisa a la página**; además solo acepta `localhost` (no una IP) como origen. Para el navegador, `localhost` y `127.0.0.1` son orígenes distintos | `google-auth`, frontends |
| LLM | La CLI **hereda el contexto** del directorio desde el que se lanza (el `CLAUDE.md` y la memoria del proyecto), lo que contaminaba las respuestas; se resolvió lanzándola desde una carpeta neutra | Módulo LLM |
| Entorno de ejecución | `uvicorn` y los servidores Node **no recargan el código solos** (Vite sí). Además, `virtualenvwrapper` y `nvm` no son compatibles con `set -e`: el script se detenía en silencio | Todos los módulos, `run.sh` |
| Pruebas | Chromium en WSL necesitó 24 paquetes del sistema adicionales (librerías y tipografías) con `sudo` | Prueba E2E |
| Pruebas | Las pruebas de contrato (humo y E2E) **detectaron diferencias reales** entre variantes: el fallo del ORM, el de la contraseña y el de las plantillas de Vue aparecieron al ejecutarlas, no al escribir el código | Todos |

## Qué no cubre

- No incluye ningún módulo del producto más allá de lo anterior: Constructor, Ejecución, Evaluación Automática,
  Catálogo SFIA, Analítica, eventos, roles ni el tutor socrático.
- El acceso a la BD está concentrado en el backend, lo que difiere de la arquitectura original (un schema por módulo).
- El LLM se invoca por la CLI local, con tu sesión: sirve para la PoC, no representa cómo se conectará el producto.
- Corre en local y sin contenedores: el entorno no es reproducible (las versiones dependen de la máquina).

---

El resto de este documento explica cómo ejecutarla y probarla. Todos los comandos se ejecutan **desde la raíz del
repositorio**, en WSL2 (Ubuntu).

---

## 1. Requisitos (una sola vez)

| Herramienta | Para qué | Cómo instalarla |
|---|---|---|
| PostgreSQL 16 | Base de datos | `sudo apt install postgresql postgresql-contrib` y `sudo service postgresql start` |
| Python 3.12 + virtualenvwrapper | Módulos Python | `sudo apt install virtualenvwrapper` (Python ya viene con Ubuntu) |
| Node.js 24 (con nvm) | Backend Node, frontends y prueba E2E | Instalar nvm (ver `github.com/nvm-sh/nvm`) y luego `nvm install --lts` |
| CLI `claude` con sesión iniciada | Módulo LLM | Debe estar instalada y con la sesión abierta |
| Cliente OAuth de Google | Login | En Google Cloud Console: ID de cliente y secreto, URI de redirección `http://localhost:8001/auth/callback` y origen autorizado de JavaScript `http://localhost:5173` |
| Librerías de Chromium | Prueba E2E | `cd poc/tests/e2e && sudo env "PATH=$PATH" npx playwright install-deps chromium` (después de la primera ejecución de la prueba) |

---

## 2. Módulos, variantes y puertos

Cada rol tiene un **puerto fijo** y se levanta **una sola variante a la vez**. Para cambiar de variante, se detiene la
que corre (Ctrl+C) y se levanta otra.

| Módulo | Variante | Comando | Puerto |
|---|---|---|---|
| Base de datos | PostgreSQL | `bash poc/db/setup.sh` (solo la primera vez) | 5432 |
| LLM | python-cli | `bash poc/llm/run.sh` | 8002 |
| Autenticación | authlib | `bash poc/auth/authlib/run.sh` | 8001 |
| Autenticación | google-auth | `bash poc/auth/google-auth/run.sh` | 8001 |
| Backend | fastapi-psycopg | `bash poc/backend/fastapi/psycopg/run.sh` | 8000 |
| Backend | fastapi-sqlalchemy | `bash poc/backend/fastapi/sqlalchemy/run.sh` | 8000 |
| Backend | node-pg | `bash poc/backend/node/pg/run.sh` | 8000 |
| Frontend | react | `bash poc/frontend/react/run.sh` | 5173 |
| Frontend | vue | `bash poc/frontend/vue/run.sh` | 5173 |

Cada `run.sh` hace lo mismo: crea su entorno (virtualenv en Python, `node_modules` en Node) si falta, instala las
dependencias si cambiaron, crea su `.env` desde `.env.example` si no existe y arranca el servidor. Cada servidor queda
en primer plano, así que **cada módulo necesita su propia terminal**.

---

## 3. Primera vez

**1. Base de datos.**

```
cp poc/db/.env.example poc/db/.env      # editar POC_DB_PASSWORD
bash poc/db/setup.sh                    # crea el rol, la BD y las tablas; pide la clave de sudo
```

**2. Secretos compartidos.** Genera un `JWT_SECRET` con `openssl rand -hex 32`. Debe ser **el mismo valor** en la
autenticación y en el backend. `authlib` necesita además un `SESSION_SECRET` (otro valor aleatorio).

**3. Completar los `.env`.** La primera vez que se corre un `run.sh`, crea el `.env` y se detiene si faltan variables
obligatorias: se completan y se vuelve a correr.

| Módulo | Variables obligatorias |
|---|---|
| LLM | ninguna |
| Autenticación `authlib` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET` (y `FRONTEND_URL=http://localhost:5173` para volver al frontend tras el login) |
| Autenticación `google-auth` | `GOOGLE_CLIENT_ID`, `JWT_SECRET` |
| Backends | `JWT_SECRET`, `POC_DB_PASSWORD` |
| Frontends | ninguna |

El ID y el secreto de Google se copian del JSON que descarga Google Cloud Console (no se sube a git).

> **Contraseña con `#`.** En el `.env` del backend Node, una contraseña que contenga `#` debe ir entre comillas dobles
> (`POC_DB_PASSWORD="..."`), porque Node lo interpreta como un comentario.

---

## 4. Levantar una combinación

Ejemplo con FastAPI + psycopg y React, en cinco terminales:

```
sudo service postgresql start               # 1. base de datos (si no está activa)
bash poc/llm/run.sh                         # 2. LLM
bash poc/auth/authlib/run.sh                # 3. autenticación
bash poc/backend/fastapi/psycopg/run.sh     # 4. backend
bash poc/frontend/react/run.sh              # 5. frontend
```

Después se abre **`http://localhost:5173`** (no `http://127.0.0.1:5173`: el backend y Google solo autorizan
`localhost`).

El frontend **detecta solo** qué módulo de autenticación está corriendo y muestra el botón que corresponde. Al pie de la
pantalla, el recuadro "Módulos bajo prueba" lista la variante y las versiones de cada módulo.

Para probar otra combinación, se detiene el módulo que se quiere cambiar y se levanta su otra variante; el resto no se
toca.

---

## 5. Pruebas

| Prueba | Qué comprueba | Necesita corriendo |
|---|---|---|
| Humo (`smoke_test.py`) | Backend, LLM y BD, **sin frontend** | BD, backend y LLM (con `--sin-llm`, no el LLM) |
| E2E (`e2e/`) | La interfaz real en un navegador, con el frontend y el backend elegidos | BD, backend, frontend y LLM |
| Login con Google | El inicio de sesión real | Todo; se prueba a mano |

### Prueba de humo

```
python3 poc/tests/smoke_test.py             # completa
python3 poc/tests/smoke_test.py --sin-llm   # omite las llamadas a la CLI (lentas)
```

- Fabrica un token con el `JWT_SECRET`, así que no depende del login con Google. Lo toma de la variable de entorno
  `JWT_SECRET` o de `poc/auth/authlib/.env`.
- Imprime la variante y las versiones de cada módulo y las repite en la última línea, para anotarlas junto con el
  resultado.
- Comprueba autenticación (token ausente, falso, con otro secreto y expirado), ítems (listar, crear, crear inválido),
  `GET /modulos` y la IA.
- Crea un usuario y un ítem de prueba y los borra al terminar.
- Termina con `TODO OK`, o con el número de comprobaciones que fallaron.

### Prueba E2E (navegador)

```
bash poc/tests/e2e/run.sh                                 # contra el frontend en http://localhost:5173
bash poc/tests/e2e/run.sh --grep "formulario"             # solo una de las pruebas
FRONTEND_URL=http://localhost:5174 bash poc/tests/e2e/run.sh
```

- La primera vez instala Playwright y descarga Chromium (~150 MB). Si el navegador no arranca por faltar librerías del
  sistema, se instalan con el comando de la sección 1.
- Abre el frontend en un Chromium sin ventana y comprueba: el panel con el usuario y el recuadro de módulos, crear un
  ítem con el formulario y verlo en la tabla, y la consulta a la IA.
- **El login con Google no se automatiza.** La prueba fabrica un token y lo deja en el `localStorage` antes de abrir la
  página.
- El mismo test sirve para React y Vue: cada frontend debe cumplir el contrato de interfaz descrito al inicio de
  `poc/tests/e2e/tests/interfaz.spec.ts`.
- Borra su usuario y sus ítems de prueba al terminar.

### Login real con Google (a mano)

1. Levantar la combinación de la sección 4 y abrir `http://localhost:5173`.
2. Con `authlib`: pulsar «Iniciar sesión con Google», elegir la cuenta y comprobar que se vuelve al panel con tu nombre.
3. Con `google-auth`: usar el botón de Google que muestra la página.
4. Comprobar la tabla, el formulario y la consulta a la IA.

El token dura una hora; después hay que volver a iniciar sesión.

---

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Se cambió el código de un módulo y no pasa nada | `uvicorn` y Node no recargan el código solos | Detener el módulo (Ctrl+C) y levantarlo de nuevo. Vite (frontends) sí recarga |
| El frontend dice «No se pudo consultar al backend…» y el backend está corriendo | La página se abrió en `http://127.0.0.1:5173` | Abrir `http://localhost:5173` |
| El backend Node responde 500 en los endpoints con base de datos | La contraseña de la BD tiene `#` sin comillas en su `.env` | Poner la contraseña entre comillas dobles |
| `run.sh` se detiene diciendo «Completa en …/.env» | Faltan variables obligatorias | Completarlas y volver a correr el comando |
| El puerto ya está en uso | Hay otra variante del mismo rol corriendo | Detenerla con Ctrl+C |
| `redirect_uri_mismatch` de Google | La URI del `.env` no coincide con la registrada en Google | Debe ser exactamente `http://localhost:8001/auth/callback` |
| El botón de Google se ve pero rechaza el acceso | `http://localhost:5173` no está autorizado como origen | Agregarlo en «Orígenes autorizados de JavaScript» del cliente OAuth |
| La respuesta de la IA menciona el proyecto o la tesis | La CLI heredó el contexto de la carpeta desde la que se lanzó | El módulo LLM la lanza desde una carpeta neutra; revisar `LLM_CLI_CWD` en su `.env` |
| La prueba E2E falla al abrir el navegador | Faltan librerías del sistema para Chromium | Ejecutar el comando de instalación de la sección 1 |
| `GET /modulos` muestra un módulo como «sin respuesta» | Ese módulo no está corriendo | Levantarlo (el de autenticación solo es necesario para iniciar sesión) |
