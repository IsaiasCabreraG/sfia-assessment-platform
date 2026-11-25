# Sprint 1: guía del código

> El Sprint 2 (constructor de evaluaciones) tiene su propia guía: `code-guide-sprint-2.md`.

Esta guía explica **qué hace cada archivo y cada función** del Sprint 1, y **por dónde pasa una acción** de punta a punta (por ejemplo, qué archivos y funciones se ejecutan cuando alguien inicia sesión o publica ítems).

Las rutas de las secciones 3 a 7 se escriben **relativas a la carpeta de su módulo**, para que sean cortas. Para ubicarlas en el proyecto:

| Se escribe en esta guía | Está en |
|---|---|
| `identity/…` | `modules/identity/identity/…` |
| `catalog/…` | `modules/catalog-sfia/catalog/…` |
| `content/…` (incluye `content/generation/prompt.json`) | `modules/content-generation/content/…` |
| `llm/…` | `modules/llm-gateway/llm/…` |
| `shared/…` | `modules/shared/shared/…` |
| `web/src/…` | `web/management-portal/src/…` |
| `db/…`, `tests/…` | `db/…`, `tests/…` (en la raíz del proyecto) |
| `run.sh`, `run_all.sh`, `scripts/…` | `tools/run.sh`, `tools/run_all.sh`, `tools/…` |

Los comandos se ejecutan desde la raíz del proyecto. Los números de línea son aproximados: sirven para ubicarse, no para citar.

**Contenido**
1. [Cómo está armado](#1-cómo-está-armado)
2. [Mapa de carpetas](#2-mapa-de-carpetas)
3. [Recorridos de punta a punta](#3-recorridos-de-punta-a-punta)
4. [Referencia del backend, archivo por archivo](#4-referencia-del-backend-archivo-por-archivo)
5. [Referencia del frontend, archivo por archivo](#5-referencia-del-frontend-archivo-por-archivo)
6. [Base de datos](#6-base-de-datos)
7. [Pruebas](#7-pruebas)
8. [Cómo ejecutar todo](#8-cómo-ejecutar-todo)
9. [Reglas de negocio y límites conocidos](#9-reglas-de-negocio-y-límites-conocidos)

---

## 1. Cómo está armado

Hay **cuatro módulos de backend** (cada uno es una app FastAPI independiente, con su puerto), **un frontend** con dos portales y **una base de datos** PostgreSQL.

```
 Navegador (Next.js, puerto 5173)
   ├─ /docente/     Portal Docente/Reclutador
   └─ /validador/   Portal Validador
        │  (REST + JWT en el encabezado Authorization)
        ▼
 identity :8001   catalog :8002   llm :8003   content :8004
        │              │             ▲            │  │
        │              │             └────────────┘  │ (content llama a llm con HTTP)
        └──────────────┴──────────────────────────────┴──► PostgreSQL :5432
                                                       (schemas identity, catalog, content, events)
```

| Módulo | Puerto | Qué hace | HU |
|---|---|---|---|
| `identity` | 8001 | Login con Google, sesión (access + refresh token) y roles | HU-01 |
| `catalog` | 8002 | Consulta del catálogo SFIA: skills, niveles y perfiles de rol | HU-02 |
| `llm` | 8003 | Recibe un texto y lo manda al proveedor de IA configurado: la API de **Groq** o la CLI de Claude | HU-04, HU-06 |
| `content` | 8004 | Genera borradores con IA, publica ítems, filtra, muestra, activa y puntúa | HU-03 a HU-10, HU-25, HU-27 a HU-31 |

### Las tres capas de cada módulo

Dentro de cada módulo, el código se reparte en capas. Una petición siempre baja por ellas en este orden:

```
routes.py      →  service.py     →  repository.py   →  PostgreSQL
(HTTP)            (reglas)           (SQL)
```

- **`routes.py`**: recibe la petición HTTP, comprueba el rol del usuario y llama a `service`. No tiene reglas de negocio.
- **`service.py`**: aquí viven las **reglas** (validar, decidir, coordinar). No escribe SQL.
- **`repository.py`**: solo **SQL**. Cada función es una consulta.

Por eso, para entender "qué pasa cuando…", se sigue la cadena `routes → service → repository`.

### Código compartido (`shared/`)

Lo usan los cuatro módulos: configuración, conexión a la BD, errores, JWT y roles, eventos y la fábrica de la app.

### Sesión y permisos en una frase

Al iniciar sesión se entregan dos tokens: un **access token** (JWT, dura 1 hora, va en cada petición) y un **refresh token** (dura 7 días, sirve una vez, cambia por tokens nuevos). Los **roles** (`teacher_recruiter`, `validator`) viajan dentro del JWT y salen de la tabla `identity.user_roles`, que funciona como lista blanca de cada portal.

---

## 2. Mapa de carpetas

```
(raíz del proyecto)
├─ .env                      Configuración local (secretos). No se sube a git
├─ .env.example              Plantilla del .env
├─ requirements.txt          Dependencias de Python
├─ pytest.ini                Configuración de las pruebas y PYTHONPATH de los módulos
├─ tools/
│   ├─ run.sh                Levanta un módulo:  bash tools/run.sh identity|catalog|llm|content
│   ├─ run_all.sh            Levanta todo lo que falte (módulos y portales) en una sola terminal
│   ├─ lib.sh                Funciones comunes (entorno virtual, .env y PYTHONPATH)
│   ├─ run_python.sh         Ejecuta un script Python con el entorno del proyecto
│   ├─ reporte_log_ia.sh     Genera (y con --abrir abre) el reporte del log de IA (solo desarrollo)
│   ├─ ver_log_ia.py         Genera el visor HTML del log de IA (lo usa reporte_log_ia.sh)
│   └─ logs/                 Logs de run_all.sh (no se sube a git)
├─ modules/
│   ├─ shared/shared/        Código común a los cuatro módulos
│   ├─ identity/identity/    Módulo de identidad (login, sesión, roles)
│   ├─ catalog-sfia/catalog/ Módulo del catálogo SFIA
│   ├─ llm-gateway/llm/      Módulo que habla con la IA
│   └─ content-generation/content/   Módulo de contenido (ítems)
│       ├─ generation/       Todo lo relacionado con pedirle ítems a la IA (incluye prompt.json)
│       └─ types.py          Los seis tipos de ítem
├─ config/
│   └─ criterios-fijos.json  Criterios fijos de la rúbrica de cada tipo abierto, con sus 4 descriptores (los leen el backend y el portal)
├─ db/
│   ├─ schema.sql            Crea schemas y tablas
│   ├─ setup.sh              Crea rol y BD, aplica schema.sql y carga el catálogo
│   ├─ seed_catalog.py       Carga skills, perfiles y relaciones desde CSV
│   ├─ data/*.csv            Catálogo SFIA recortado (skills, role_profiles, role_profile_skills)
│   └─ migrations/           Cambios aplicados a una BD ya existente
├─ web/management-portal/    Frontend (Next.js + React + TypeScript)
│   └─ src/{app,shared,docente,validador}
└─ tests/                    Pruebas (pytest) y pruebas de navegador (e2e/)
```

---

## 3. Recorridos de punta a punta

Cada recorrido lista los pasos **en orden**, con el archivo y la función que se ejecuta.

### 3.1 Iniciar sesión con Google (HU-01)

1. El usuario abre `http://localhost:5173/docente/`. Se dibuja `web/src/app/docente/page.tsx`, que muestra `docente/App.tsx`, que envuelve todo en **`LoginGate`** (`shared/LoginGate.tsx`).
2. `LoginGate` (en un `useEffect`) llama a `guardarTokenDeLaUrl` (`shared/auth.ts`): no hay `#access_token` en la URL todavía. Luego `leerToken`: no hay token. Estado: **"sin sesión"**, se muestra el botón *Iniciar sesión con Google*.
3. Al pulsar el botón, `iniciarLogin(portal)` (`shared/auth.ts`) navega a `http://localhost:8001/auth/login?portal=docente`.
4. **`login`** (`identity/routes.py`): comprueba que el portal sea `docente` o `validador`, guarda el portal en la sesión de la petición y llama a `oauth.google.authorize_redirect(...)`. El cliente de Google lo configura **`build_oauth`** (`identity/google.py`). El usuario es enviado a `accounts.google.com`.
5. El usuario se autentica en Google. Google redirige a `http://localhost:8001/auth/callback`.
6. **`callback`** (`identity/routes.py`):
   - Canjea el código por el perfil del usuario (`authorize_access_token`). Si Google rechaza el código responde 400 (`OAuthError`); si la red falla al hablar con Google (tiempo agotado o conexión caída, `httpx.HTTPError`) responde **502** con el mensaje «No se pudo contactar a Google… Vuelve a intentarlo desde el portal» en lugar de un error interno. El código de Google es de un solo uso: hay que empezar el login de nuevo.
   - Llama a **`login_with_google`** (`identity/service.py`):
     1. Exige `email_verified` (si no, `BadRequest`).
     2. `repository.find_by_google_id`: si el usuario ya existe, `repository.update_profile` refresca su nombre y foto.
     3. Si no existe por `google_id`, `repository.find_by_email`. Si hay un usuario **provisional** (alguien le asignó un rol antes de su primer login, con `google_id = "pending:correo"`), se completa con el `google_id` real. Si no hay ninguno, `repository.insert_user` lo crea y `shared/events.emit_event` registra el evento `UserRegistered`.
     4. **`_start_session`**: lee los roles (`repository.get_roles`), firma el JWT con **`create_access_token`** (`shared/security.py`) y genera un refresh token aleatorio. Del refresh token se guarda **solo el hash** (`_hash` y `repository.insert_refresh_token`).
   - Redirige a `PORTAL_DOCENTE_URL#access_token=…&refresh_token=…`. Los tokens van en el **fragmento** (`#`), que el navegador nunca envía a ningún servidor.
   - Al terminar la petición, `shared/db.get_conn` hace *commit*.
7. De vuelta en el portal, `LoginGate` vuelve a ejecutar su efecto: `guardarTokenDeLaUrl` guarda ambos tokens en `localStorage` y limpia la URL.
8. `LoginGate` llama a `api(...)` (`shared/api.ts`) → `GET /auth/me` → **`me`** (`identity/routes.py`) → `service.user_with_roles`. La respuesta trae los **roles vigentes en la BD**.
   - Si el rol que exige el portal está en la BD y en el token → muestra el portal.
   - Si está en la BD pero **no** en el token (te autorizaron después de iniciar sesión) → `refrescarSesion` pide tokens nuevos, que ya traen el rol.
   - Si no está en la BD → pantalla *"Tu cuenta no está autorizada para este portal"*.

> **Quién puede entrar.** Iniciar sesión no da acceso a nada: crea un usuario sin roles. El acceso lo da una fila en `identity.user_roles`, que se agrega con `identity/grant_role.py` (ver 3.8).

### 3.2 Renovar la sesión cuando vence el access token

El access token dura 1 hora. Nadie se entera de que venció hasta la siguiente acción:

1. Cualquier llamada pasa por **`api`** (`shared/api.ts`) y el backend responde `401` (token vencido).
2. `api` llama a **`refrescarSesion`** (`shared/auth.ts`). Si varias llamadas fallan a la vez, comparten **una sola** renovación (mapa `renovaciones`), porque el refresh token sirve una vez.
3. `refrescarSesion` hace `POST /auth/refresh` → **`refresh`** (`identity/routes.py`) → **`refresh_session`** (`identity/service.py`):
   - `repository.find_refresh_token` (busca por hash).
   - Si no existe, está revocado o venció → `Unauthorized` (401).
   - Si es válido: `repository.revoke_refresh_token` (queda usado) y `_start_session` entrega un par nuevo. **Los roles se leen otra vez de la BD.**
4. Resultado, según lo que devuelva `refrescarSesion`:
   - `"ok"`: guarda los tokens nuevos y `api` **repite** la llamada original. El usuario no nota nada.
   - `"error"` (red caída o falla del servidor): `api` lanza un error con el mensaje *"No se pudo renovar tu sesión… reintenta"*. **No** cierra sesión ni recarga la página.
   - `"invalida"` (refresh vencido o revocado): `avisarSesionVencida`, `cerrarSesion` y recarga. Se ve el login con el aviso *"Tu sesión venció"*.

**Cerrar sesión:** el botón *Salir* llama a `cerrarSesion`, que envía `POST /auth/logout` → **`logout`** (`identity/routes.py`) → `service.logout` → `repository.revoke_refresh_token`. Después borra los tokens del navegador.

### 3.3 Generar borradores con IA (HU-04, HU-06, HU-10)

**En el portal** (`/docente/` › *Generar ítems*), todo en `web/src/docente/`:

1. **`GenerateView`** (`GenerateView.tsx`) se monta. Un efecto intenta **recuperar trabajo sin publicar** desde `localStorage` (ver 3.5). Otro carga skills, niveles y perfiles de rol con `api(...)` contra `catalog` (ver 3.9).
2. **Paso 1 «Qué evaluar»** (`StepEvaluar.tsx`): el usuario añade skills con *+ Añadir skill…*, que abre el menú de `SkillPicker` (`shared/SkillPicker.tsx`: skills por categoría y subcategoría, con buscador). Cada skill es un **recuadro** (`Box`) que muestra su nombre (no se cambia desde ahí: se quita y se añade otra), el nivel junto a él, (nivel con celdas de color de `shared/Niveles.tsx`; solo se pueden elegir los niveles de la skill), **contexto para la skill** (opcional) y, por cada tipo de ejercicio marcado, la **cantidad** y los **minutos por ítem**. `nuevoBox` crea un recuadro. También puede añadir varias a la vez con *+ Añadir skills de un rol…*, que abre `RolPicker` (`docente/RolPicker.tsx`): las 21 familias de roles como acordeón y, al elegir un rol, `cargarPerfil` trae sus skills (`GET /role-profiles/{id}`), que se muestran separadas en **core** y **related**, **ninguna marcada de antemano**. Solo se añaden (un recuadro cada una) las que el usuario marca; no se guarda de qué rol salieron, así que se pueden sumar skills de un rol y luego de otro. Cada skill es una tarjeta con borde que se rellena con el color de su categoría al elegirla (sin casillas con tick). Las que ya están en el formulario aparecen rellenas con tono suave, con el aviso «ya está en el formulario», y no se pueden quitar desde ahí. **«Siguiente»** solo se activa si hay al menos una skill y todas tienen algún tipo marcado; si no, `GenerateView` muestra al lado del botón el motivo («Marca al menos un tipo de ítem en: PROG») y el recuadro afectado lo repite.
3. **Paso 2 «Resumen»** (`GenerateView.tsx`): un resumen de cada recuadro (`ResumenCompacto`): la skill con el color de su categoría, su nivel y, por cada tipo, su icono, la cantidad y los minutos, más su contexto. Al pulsar **Generar** se ejecuta `generar(grupos)`.
4. `grupos` es una lista con un elemento por cada combinación *(recuadro, tipo)*. `generar` lanza hasta 3 pedidos en paralelo (`SIMULTANEAS`). Cada uno ejecuta **`pedir(g)`**, que hace `POST /drafts` con `{skill_id, level, item_type, item_count, estimated_minutes, context}`.

**En el backend** (`content`, puerto 8004):

5. **`create_drafts`** (`content/routes.py`): exige rol `teacher_recruiter` y lee el encabezado `Authorization`. Llama a `service.generate_drafts`.
6. **`generate_drafts`** (`content/service.py`):
   1. `_check_request`: la skill existe (`repository.get_skill`), el nivel es 1–7 (`repository.get_level_title`), el tipo es válido, el tiempo es mayor que 0 y la skill tiene descripción (el prompt la necesita; si falta, `BadRequest`).
   2. Valida que la cantidad esté entre 1 y 10 (`MAX_ITEMS_PER_REQUEST`).
   3. **`_elegir_objetivos`** (solo alternativa única y verdadero o falso; HU-04-2 y HU-04-7): consulta cuántas correctas hay en cada opción de todo el banco (`repository.correct_position_counts` y `true_false_counts`) y sortea la correcta de cada ítem nuevo (`balance.elegir_objetivos`), con más probabilidad para las opciones menos usadas. Al regenerar un borrador se conserva la que tenía (`correct_position` o `correct_answer`).
   4. **`_ask_for_items`** repite hasta `MAX_ATTEMPTS` (2) veces:
      - `build_prompt` (`content/generation/prompts.py`) arma el prompt leyendo el texto de `content/generation/prompt.json` (ver 4.6.1): skill con su descripción completa, nivel, tiempo, contexto de la skill, reglas del tipo, la correcta pedida para cada ítem, los criterios fijos de la rúbrica con sus descriptores (tipos abiertos) y la forma exacta del JSON esperado.
      - `ask_llm` (`content/generation/llm_client.py`) hace `POST http://localhost:8003/ask`, reenviando el mismo JWT del usuario.
      - En el módulo `llm`, **`ask`** (`llm/routes.py`) llama a **`generate`** (`llm/provider.py`), que elige el proveedor según `LLM_PROVIDER`: **`run_groq`** (`llm/groq.py`) hace `POST https://api.groq.com/openai/v1/chat/completions` con la clave y el modelo del `.env`, o **`run_cli`** (`llm/cli.py`) lanza `claude -p` como subproceso.
      - `extract_json` (`content/generation/parser.py`) saca el objeto JSON del texto (tolera ```` ```json ````).
      - Se comprueba que lleguen exactamente los ítems pedidos.
      - `validate_items` (`content/generation/schemas.py`) valida cada ítem contra las reglas de su tipo (ver 9).
      - Alternativa única y verdadero o falso: `check_objetivos` (`content/generation/checks.py`) comprueba que la correcta sea la pedida y, en alternativa única, `check_opciones_posicionales` que una opción que dependa de otras («todas las anteriores», «A y B») esté solo en la última posición.
      - Si falla la validación, se reintenta una vez agregando al prompt el error anterior. Si falla el módulo `llm`, **no** se reintenta.
      - Tipos abiertos (HU-04-4): son **dos pasos**. El primero pide los ítems con solo 2 criterios propios de rúbrica y sin la respuesta de referencia: `check_rubrica_ia` exige exactamente 2 criterios de peso 25 con nombres distintos de los fijos y `con_criterios_fijos` (`content/generation/rubric.py`) les agrega los criterios fijos del tipo, con sus 4 descriptores, de `config/criterios-fijos.json`; se valida todo lo demás. El segundo, con `build_reference_prompt`, pide en una sola llamada la respuesta de referencia de todos los ítems a partir de su enunciado y su rúbrica; cada paso tiene sus propios reintentos.
   5. Devuelve los borradores (`model_dump`). **No se guarda nada en la BD.** Si la IA no logra ítems válidos, lanza `BadGateway` (502) con el motivo.
7. El portal arma la lista de borradores **en el orden de los recuadros** (no en el orden en que terminan los pedidos) y pasa al Paso 3. Los pedidos que fallaron se muestran como errores sin impedir seguir con los demás.

### 3.4 Revisar, editar, regenerar y descartar borradores (HU-27 a HU-30)

Todo ocurre en `ReviewView.tsx`, `shared/VistaItem.tsx` y `DraftEditor.tsx`, **sin llamar a la BD**. La pantalla tiene la lista de borradores a la izquierda y, a la derecha, el borrador elegido completo, con **editar, regenerar y descartar como iconos** arriba:

| Acción | Función | Qué hace |
|---|---|---|
| Ver | `ReviewView` y `VistaItem` | La lista muestra cada borrador con el icono de su tipo, la skill, el nivel con el color de su categoría, el tiempo y el enunciado. El elegido se ve completo, sin entrar a editar, separado en **«Lo que verá quien rinda»** (marco azul; cada dato con su título: enunciado, alternativas, código…) y **«Solo para el docente/reclutador»** (marco punteado: qué evalúa, respuesta correcta o de referencia y la rúbrica como matriz de criterios por niveles) |
| Saber en cuál voy | encabezado fijo del panel | «Borrador N de M», siempre visible, con flechas para pasar al anterior o al siguiente |
| Cambiar el tiempo | campo «Tiempo (min)» en `ReviewView` | Cada borrador tiene su propio tiempo estimado |
| Editar | icono ✏ y `DraftEditor` | Cambia la vista por los campos del tipo (opciones, firma, tests, escenario, rúbrica…), **en el mismo orden que la vista**: enunciado, lo que verá quien rinda, «qué evalúa», lo que solo ve el docente y la rúbrica. Cada cambio actualiza el borrador en pantalla |
| Regenerar | `regenerar(d)` en `ReviewView` | `POST /drafts` con `item_count = 1`, el contexto con que se generó el borrador (`d.context`), un comentario opcional (`feedback`) y el enunciado anterior (`previous_statement`) y la correcta que tenía (`correct_position` o `correct_answer`). El icono abre, **debajo del borrador**, una caja con el comentario para la IA y el botón «Regenerar este borrador». El resultado **reemplaza** el contenido del borrador |
| Descartar / Restaurar | icono 🗑 / ↩ y `cambiar(id, { discarded })` | Marca el borrador; el descartado se ve en gris y no se publica |
| Volver (HU-30-2) | botón «Volver» y `alVolver` de `GenerateView` | Pide confirmación; luego **descarta los borradores generados** (`drafts` y `fallos` quedan vacíos) y regresa al Paso 2 **conservando los recuadros** (skills, nivel, contexto y tipos) para generar otra tanda |

El botón **«Publicar N preguntas»** cuenta solo los no descartados.

### 3.5 Conservación del trabajo sin publicar (HU-27, criterio 4)

En `GenerateView.tsx`:

- Un efecto **guarda** en `localStorage` (clave `sprint1_borradores_docente`) los recuadros (cada uno con su contexto), los borradores (cada uno con el suyo) y el paso actual, cada vez que cambian. El trabajo guardado antes de que el contexto fuera por skill se sigue recuperando: su contexto único se reparte entre sus recuadros y borradores.
- Al abrir la pantalla, otro efecto **recupera** ese trabajo y muestra el aviso *"Recuperamos tu trabajo sin publicar"* con el botón *Empezar de cero* (`reiniciar`).
- Se borra al **publicar** o al empezar de cero (`olvidarTrabajo`).
- Así sobrevive a recargar la página, cerrar la pestaña o volver a iniciar sesión.

### 3.6 Publicar los borradores (HU-28, HU-31)

1. En el pie del Paso 3, el usuario marca o no *«Dejar las preguntas a disposición de expertos»* y pulsa **Publicar**: `publicar()` (`ReviewView.tsx`).
2. `publicar` agrupa los borradores no descartados por *(skill, nivel, tipo, minutos, contexto)*, limpia cada contenido con `limpiar` (quita líneas, opciones y hallazgos vacíos) y envía `POST /items/publish` con `{available_to_experts, groups}`.
3. **`publish_items`** (`content/routes.py`) exige rol `teacher_recruiter` y llama a **`publish_items`** (`content/service.py`):
   1. Valida el número de grupos y, por cada uno, `_check_request` y `validate_items` (**las ediciones del usuario pasan por las mismas reglas que lo generado por la IA**). Si algo falla, lanza `BadRequest` (400) **antes de escribir nada**.
   2. Por cada grupo: `repository.insert_generation_request` (estado `completed`).
   3. Por cada ítem del grupo: `repository.insert_item` (activo y con `available_to_experts`), `repository.insert_version` (versión 1, origen `generated`) y `repository.insert_content`, que guarda el contenido propio del tipo (opciones, tabla de extensión, hallazgos y rúbrica). Luego `emit_event` registra `ItemVersionCreated`.
4. Todo ocurre en **una transacción**: o se guarda todo o nada.
5. El portal ejecuta `olvidarTrabajo` y muestra *"Publicación lista"* con el botón *Generar más preguntas*.

### 3.7 Banco de ítems: listar, filtrar y ver el detalle (HU-03, HU-07, HU-08, HU-09, HU-25)

Lo hace `ItemBrowser` (`shared/ItemBrowser.tsx`), que usan los dos portales con `modo="docente"` o `modo="validador"`.

**Listar y filtrar** (`GET /items?…`):

1. En la pantalla, la skill se elige con `SkillPicker` (con la opción «Todas las skills») y hay un desplegable de **nivel de responsabilidad** (los niveles salen de `GET /levels` de `catalog`). `ItemBrowser` arma la consulta con `consulta(...)` (`shared/api.ts`) y llama a `api`.
2. **`list_items`** (`content/routes.py`) → **`list_items`** (`content/service.py`):
   - Si el usuario **no** tiene rol `teacher_recruiter`, fuerza `status = active` y solo ve los ítems **disponibles para expertos**.
   - Valida `status`, `scored`, `item_type` y el rango de `min_score` / `max_score` (de 1 a 5).
   - Llama a `repository.list_items` con la consulta `_LIST_SQL`, que une el ítem con su **versión vigente** y con el **promedio y la cantidad de puntuaciones** (`round(avg(score), 1)` y `count(*)`).
3. Los filtros que ofrece el SQL: skill, **rol** (a través de las skills del perfil en `catalog.role_profile_skills`), tipo, nivel, sin puntuar / puntuados y rango de promedio. Un ítem **sin puntuar** tiene promedio `NULL` y cantidad 0, distinto de cualquier promedio (el mínimo es 1).
4. El resultado es `{ total, items }`, con paginación de 20 en el portal. En cada fila, la puntuación (`Puntuacion`: cinco estrellas y promedio) va a la altura del nombre de la skill; **si el ítem no fue puntuado muestra una estrella tachada**; en el portal docente la fila lleva además la etiqueta «público» o «privado».

**Detalle** (`GET /items/{id}`): `get_item` → `service.item_detail` → `_get_visible_item` (aplica la misma regla de visibilidad) → `repository.get_type_content` (contenido del tipo, incluida la respuesta correcta o de referencia), `repository.get_rubric` (solo tipos abiertos), `repository.get_score_summary` (promedio y cantidad) y `repository.get_my_score`. En el portal lo dibuja `ItemDetail`.

**Activar o desactivar** (HU-09): el botón del Portal Docente llama a `PATCH /items/{id}/status` → `service.set_status` → `repository.set_item_status`. Al desactivar se registra `ItemDeactivated`. Un ítem inactivo no lo ve el validador.

### 3.8 Puntuar un ítem (HU-05)

1. En el Portal Validador, `ScoreForm` (`validador/ScoreForm.tsx`) envía `PUT /items/{id}/score` con `{score}`.
2. **`score_item`** (`content/routes.py`) exige rol `validator` y llama a **`score_item`** (`content/service.py`):
   - Rechaza lo que no sea un **entero de 1 a 5** (por ejemplo, 0, 6 o 4.5 → 400).
   - `_get_visible_item`: el validador solo puede puntuar lo que puede ver.
   - `repository.upsert_score`: un validador tiene **una** puntuación por versión; si vuelve a puntuar, **reemplaza** la anterior.
   - `emit_event` registra `ItemScored` y se devuelve el nuevo promedio y la cantidad.
3. Varios validadores pueden puntuar el mismo ítem: el promedio y la cantidad se calculan sobre todas las filas de `content.item_scores`.

### 3.9 Consultar el catálogo SFIA (HU-02)

- **Botón «Catálogo SFIA ↗»** (`docente/App.tsx`): es un enlace (`SFIA_URL`) al sitio oficial; no llama al backend.
- **Datos para generar**: `GenerateView` y `ItemBrowser` llaman a `catalog` con `api`:
  - `GET /skills` → **`list_skills`** (`catalog/routes.py`) → `service.skills` → `repository.list_skills`.
  - `GET /levels` → niveles 1 a 7.
  - `GET /role-profiles` y `GET /role-profiles/{id}` → perfiles y las skills de cada uno (con nivel mínimo y máximo de la skill, y si es primaria).
- El catálogo lo carga `db/seed_catalog.py` desde los CSV (ver 4.8).

### 3.10 Asignar roles (la lista blanca)

```
bash tools/run_python.sh modules/identity/identity/grant_role.py correo@x.com teacher_recruiter validator
```

`main` (`identity/grant_role.py`) llama a `service.grant_role` (`identity/service.py`): busca al usuario por correo (`repository.find_by_email`); si no existe, crea uno **provisional** (`google_id = "pending:correo"`); y agrega el rol (`repository.insert_role`). El rol queda vigente en el token **la próxima vez que se renueve la sesión**. Con `--quitar` se revoca el rol (`service.revoke_role`).

---

## 4. Referencia del backend, archivo por archivo

### 4.1 `shared/` (código común)

| Archivo | Función / clase | Qué hace |
|---|---|---|
| `config.py` | `env(nombre, por_defecto)` | Lee una variable de entorno (carga `.env` al importarse). Si falta y no hay valor por defecto, falla con un mensaje claro |
| | `env_lista(nombre, por_defecto)` | Lee una variable con valores separados por coma y la devuelve como lista |
| `db.py` | `_dsn()` | Arma la cadena de conexión a PostgreSQL con las variables `DB_*` |
| | `get_pool()` | Crea el pool de conexiones la primera vez y lo reutiliza |
| | `get_conn()` | **Dependencia de FastAPI**: entrega una conexión por petición; hace *commit* si el endpoint termina bien y *rollback* si lanza una excepción |
| | `connect()` | Conexión suelta para scripts fuera de FastAPI (seed, grant_role, pruebas) |
| `errors.py` | `AppError` y subclases | Errores de negocio con su código HTTP: `NotFound` 404, `BadRequest` 400, `Unauthorized` 401, `Forbidden` 403, `BadGateway` 502 |
| | `register_error_handlers(app)` | Convierte cualquier `AppError` en una respuesta JSON `{"detail": mensaje}` |
| `security.py` | `AuthUser` | Usuario autenticado: `id`, `email`, `name`, `roles` |
| | `create_access_token(...)` | Firma el JWT (HS256) con `sub`, `email`, `name`, `roles`, `iat` y `exp` |
| | `decode_token(token)` | Valida firma y expiración y devuelve el `AuthUser`; si no es válido, responde 401 |
| | `current_user(creds)` | **Dependencia**: exige `Authorization: Bearer <jwt>` y devuelve el usuario |
| | `require_roles(*roles)` | **Dependencia**: exige al menos uno de los roles; si no, 403 |
| `events.py` | `emit_event(cur, type, aggregate_id, payload)` | Inserta un evento en `events.events` dentro de la misma transacción que el cambio |
| `app_factory.py` | `create_app(modulo, titulo)` | Crea la app FastAPI con CORS, manejo de errores y `GET /health` |

### 4.2 `identity/` (login, sesión y roles)

| Archivo | Función | Qué hace |
|---|---|---|
| `main.py` | — | Crea la app, agrega el middleware de sesión (guarda el `state` de OIDC y el portal de destino) y registra las rutas |
| `google.py` | `build_oauth()` | Configura el cliente OIDC de Google (Authlib) con el id y el secreto del `.env`, y 15 segundos de margen para conectarse |
| `routes.py` | `login(request, portal)` | `GET /auth/login`: guarda el portal y redirige a Google |
| | `callback(request, conn)` | `GET /auth/callback`: registra al usuario y redirige al portal con los tokens en el fragmento |
| | `refresh(body, conn)` | `POST /auth/refresh`: cambia un refresh token por un par nuevo |
| | `logout(body, conn)` | `POST /auth/logout`: revoca el refresh token (responde 204) |
| | `me(user, conn)` | `GET /auth/me`: usuario y roles vigentes en la BD |
| `service.py` | `_hash(token)` | SHA-256 del refresh token: solo el hash se guarda en la BD |
| | `_start_session(cur, user)` | Emite el access token (con los roles actuales) y un refresh token nuevo con su vencimiento (`REFRESH_TTL_SECONDS`) |
| | `login_with_google(cur, profile)` | Registra o actualiza al usuario con su perfil de Google y devuelve `(usuario, access, refresh)` |
| | `refresh_session(cur, refresh_token)` | Renueva la sesión con **rotación**: el token usado queda revocado |
| | `logout(cur, refresh_token)` | Revoca el refresh token si existe |
| | `grant_role(cur, email, role)` | Asigna un rol; crea un usuario provisional si el correo aún no inició sesión |
| | `revoke_role(cur, email, role)` | Quita un rol |
| | `user_with_roles(cur, user_id)` | Usuario con los roles que tiene hoy en la BD |
| `repository.py` | `find_by_google_id`, `find_by_email` | Busca un usuario |
| | `insert_user`, `update_profile` | Crea un usuario; actualiza su perfil (y fija el `google_id` real si era provisional) |
| | `get_roles`, `insert_role`, `delete_role` | Lee, agrega y quita roles en `identity.user_roles` |
| | `insert_refresh_token`, `find_refresh_token`, `revoke_refresh_token` | Operaciones sobre `identity.refresh_tokens` |
| | `get_user` | Usuario por id |
| `grant_role.py` | `main()` | Programa de línea de comandos para asignar o quitar roles |

### 4.3 `catalog/` (catálogo SFIA)

| Archivo | Función | Qué hace |
|---|---|---|
| `main.py` | — | Crea la app y registra las rutas |
| `routes.py` | `list_skills`, `list_categories`, `get_skill`, `list_levels`, `list_profiles`, `get_profile` | Un endpoint `GET` por cada consulta. Todos exigen estar autenticado con algún rol de portal |
| `service.py` | `skills`, `skill_detail`, `categories`, `levels`, `profiles`, `profile_detail` | Reglas mínimas: lanza `NotFound` si la skill o el perfil no existen; el detalle del perfil incluye sus skills |
| `repository.py` | `list_skills`, `get_skill`, `list_categories`, `list_levels`, `list_profiles`, `get_profile`, `get_profile_skills` | SQL sobre el schema `catalog`. La lista de skills no incluye la descripción larga; el detalle sí. Cada skill trae `min_level` y `max_level` |

### 4.4 `llm/` (acceso a la IA)

| Archivo | Función | Qué hace |
|---|---|---|
| `main.py` | — | Crea la app y registra las rutas |
| `routes.py` | `ask(req)` | `POST /ask`: recibe `{prompt}` y devuelve `{answer}` más los datos de la llamada: `provider`, `model`, `duration_ms`, `usage` (tokens) y `parameters` (temperatura, esfuerzo de razonamiento y máximo de tokens). Lo que un proveedor no informa se devuelve como `--` |
| `provider.py` | `generate(prompt)` | Elige el proveedor según `LLM_PROVIDER` (`groq` o `cli`; por defecto `cli`) y le pasa el prompt. Devuelve una `Respuesta` con el nombre del proveedor y la duración medida. Si el nombre no existe, `BadGateway` |
| `respuesta.py` | `Respuesta`, `SIN_DATO` | Lo que devuelve un proveedor: texto, modelo, tokens y parámetros; cada campo no informado vale `--` |
| `groq.py` | `run_groq(prompt)` | Llama a la API de Groq (compatible con OpenAI) con `GROQ_API_KEY`, `LLM_MODEL`, `LLM_MAX_TOKENS` y `LLM_TEMPERATURE`. Ante un 429 espera lo que indique `retry-after` (máximo 30 s) y reintenta hasta 2 veces. Traduce cada fallo a un `BadGateway` con un mensaje accionable: falta la clave, clave rechazada, límite de uso agotado, respuesta cortada por tokens, tiempo agotado o servidor caído |
| | `listar_modelos()` | `GET /models`: los modelos que la cuenta puede usar (para elegir `LLM_MODEL`) |
| | `_espera`, `_mensaje_de_error` | Calculan la espera del reintento y extraen el mensaje de error que devuelve Groq |
| `cli.py` | `run_cli(prompt)` | Ejecuta el comando de `LLM_CLI_COMMAND` (por defecto `claude -p`) como subproceso: prompt por stdin, sin shell, con límite de tiempo y desde una carpeta neutra. Si el comando no existe, se agota el tiempo o falla, lanza `BadGateway` (502) |
| `probar.py` | `main()` | Script para comprobar el proveedor del `.env`: un pedido mínimo; con `--modelos`, los modelos disponibles en tu cuenta; y con `--generacion [tipo]`, un ítem con el mismo prompt y validaciones de la aplicación |

### 4.5 `content/` (ítems)

| Archivo | Función | Qué hace |
|---|---|---|
| `main.py` | — | Crea la app y registra las rutas |
| `types.py` | `ITEM_TYPES` | Los seis tipos con su nombre y si son abiertos |
| | `OPEN_TYPES` | Los tipos que llevan rúbrica: pregunta de desarrollo, system design y debugging |
| | `MAX_ITEMS_PER_REQUEST` | Máximo de ítems por pedido a la IA (10) |
| `routes.py` | `DraftRequest`, `PublishGroup`, `PublishBody`, `StatusBody`, `ScoreBody` | Formas de los cuerpos de las peticiones |
| | `list_item_types` | `GET /item-types`: los seis tipos (HU-10) |
| | `create_drafts` | `POST /drafts`: genera borradores sin guardarlos (solo `teacher_recruiter`) |
| | `publish_items` | `POST /items/publish`: guarda los borradores revisados (solo `teacher_recruiter`) |
| | `list_items` | `GET /items`: lista con filtros (cualquiera de los dos roles) |
| | `get_item` | `GET /items/{id}`: detalle |
| | `set_status` | `PATCH /items/{id}/status`: activa o desactiva (solo `teacher_recruiter`) |
| | `score_item` | `PUT /items/{id}/score`: puntúa (solo `validator`) |
| `service.py` | `generate_drafts(...)` | Genera borradores con la IA, sin guardar; también regenera uno con comentario, conservando su correcta |
| | `_check_request(...)` | Valida skill (que exista y tenga descripción), nivel, tipo y tiempo estimado |
| | `_elegir_objetivos(...)` | Elige la respuesta correcta de cada ítem nuevo para balancear el banco (alternativa única y verdadero o falso) |
| | `_ask(...)` | Llama a la IA hasta 2 veces: arma el prompt, interpreta la respuesta y reintenta con el error anterior |
| | `_ask_for_items(...)` | Pide los ítems a la IA y valida la respuesta; los tipos abiertos van en dos pasos (ítem con rúbrica y luego respuesta de referencia) |
| | `publish_items(cur, user, available_to_experts, groups)` | Valida todo y luego guarda pedidos, ítems y versiones en una transacción |
| | `list_items(...)` | Lista con filtros y reglas de visibilidad |
| | `item_detail(cur, user, item_id)` | Atributos completos de la versión vigente, rúbrica y puntuación |
| | `_get_visible_item(...)` | Aplica quién puede ver un ítem (ver 9) |
| | `set_status(...)` | Cambia el estado; registra `ItemDeactivated` al desactivar |
| | `score_item(...)` | Registra o reemplaza la puntuación del validador |
| `repository.py` | `insert_generation_request`, `insert_item`, `insert_version`, `insert_content` | Escriben el pedido, el ítem, su versión y el contenido propio del tipo (opciones, hallazgos, rúbrica) |
| | `correct_position_counts`, `true_false_counts` | Cuántas correctas hay en A, B, C y D, y cuántos verdadero y falso, en todo el banco (para balancear la generación) |
| | `list_items(cur, filters)` | Ejecuta `_LIST_SQL` (versión vigente + promedio + filtros) |
| | `get_item_with_current_version` | Ítem con su versión más reciente |
| | `get_type_content(cur, version_id, item_type)` | Contenido propio del tipo, incluidas respuestas correctas o de referencia |
| | `get_rubric` | Criterios y descriptores 0 a 3 de una versión |
| | `set_item_status`, `upsert_score`, `get_score_summary`, `get_my_score` | Estado y puntuaciones |
| | `get_skill`, `get_level_title` | Lecturas de `catalog` que necesita `content` |

### 4.6 `content/generation/` (todo lo de la IA)

| Archivo | Función / clase | Qué hace |
|---|---|---|
| `prompt.json` | — | **El texto del prompt** (plantilla, frases opcionales, reglas y forma del JSON de cada tipo). Se edita aquí, sin tocar Python (ver 4.6.1) |
| `prompts.py` | `_cargar()` | Lee `prompt.json` al arrancar y comprueba que tenga todas sus claves y que reglas y formas cubran los mismos tipos |
| | `build_prompt(...)` | Recorre la plantilla y reemplaza los marcadores por los datos del pedido. Exige que la skill tenga descripción (se envía completa, sin recortar). Si hay `previous_error`, `feedback`, `previous_statement` u `objetivos`, agrega sus frases. En los tipos abiertos muestra los criterios fijos con sus descriptores (para que la IA no los repita), arma el ejemplo con los 2 criterios propios y, con `sin_referencia`, pide el ítem sin su respuesta de referencia |
| | `build_reference_prompt(...)` | Prompt del segundo paso de los tipos abiertos: la IA escribe la respuesta de referencia de cada ítem a partir de su rúbrica |
| `rubric.py` | `CRITERIOS_FIJOS`, `nombres_fijos`, `con_criterios_fijos` | Lee `config/criterios-fijos.json` (los 2 criterios fijos de cada tipo abierto, con peso 25 y sus 4 descriptores; también lo lee el portal) y le agrega los fijos a la rúbrica que escribió la IA |
| `balance.py` | `elegir_objetivos(conteos, cantidad)` | Sortea a qué opción apuntar con cada ítem nuevo, con más probabilidad para las menos usadas del banco |
| `checks.py` | `check_objetivos`, `check_opciones_posicionales`, `check_rubrica_ia` | Comprobaciones al generar con la IA (no al editar): la correcta es la pedida, las opciones que dependen de otras van al final y la IA escribe exactamente 2 criterios de rúbrica de peso 25 |
| `parser.py` | `extract_json(text)` | Saca el objeto JSON `{"items": [...]}` de la respuesta (tolera bloques ```` ```json ````). Lanza `ValueError` si no es válido |
| `llm_client.py` | `ask_llm(prompt, authorization)` | `POST` al módulo `llm` reenviando el JWT; traduce los fallos a `BadGateway`. Devuelve un `TextoIA`: un `str` con los datos de la llamada en `.meta` |
| `ai_log.py` | `registrar(...)`, `activo()` | Log de las llamadas a la IA, solo para desarrollo (ver 4.6.2) |
| `schemas.py` | `RubricLevel`, `RubricCriterion` | Un criterio debe tener exactamente un descriptor para los puntajes 0, 1, 2 y 3 |
| | `_WithRubric` | Base de los tipos abiertos: **al menos 4 criterios**, pesos que suman 100, nombres no repetidos y los 2 criterios fijos del tipo (la IA genera exactamente 4 de peso 25; quien edita puede agregar más) |
| | `SingleChoice`, `TrueFalse`, `OpenQuestion`, `Coding`, `SystemDesign`, `Debugging` | Un modelo por tipo con sus reglas (ver 9) |
| | `validate_items(item_type, raw_items)` | Valida cada ítem contra el modelo de su tipo. Lanza `ValueError` con el detalle de cada error |

#### 4.6.1 El prompt (`content/generation/prompt.json`)

Hay **una sola plantilla** para todos los pedidos; lo que cambia entre pedidos son los datos que se rellenan y, según el tipo, las reglas y la forma del JSON.

| Clave de `prompt.json` | Qué contiene |
|---|---|
| `plantilla` | Las líneas del prompt, en orden. Los `{marcadores}` se reemplazan por los datos del pedido: `{cantidad}`, `{tipo}`, `{skill_codigo}`, `{skill_nombre}`, `{skill_descripcion}`, `{nivel}`, `{nivel_titulo}`, `{minutos}`, `{reglas}`, `{forma_json}` |
| `opcionales` | Frases que solo aparecen si existe el dato: `contexto` (contexto de la skill), `regenerar` (enunciado anterior; al regenerar un borrador), `feedback` (comentario del usuario), `objetivos` (la correcta de cada ítem), `criterios` (criterios fijos de la rúbrica; tipos abiertos) y `sin_referencia` (primer paso de los tipos abiertos). En la plantilla se llaman con `{?nombre}` |
| `plantilla_referencia`, `forma_json_referencia` | Prompt y forma del JSON del segundo paso de los tipos abiertos (la respuesta de referencia de cada ítem) |
| `reintento` | Frase que se agrega al final cuando la IA devolvió una respuesta inválida, con los errores |
| `reglas_por_tipo` | Reglas de cada uno de los seis tipos (p. ej. «exactamente una opción correcta») |
| `forma_json_por_tipo` | Ejemplo del JSON que debe devolver la IA, por tipo |
| `version`, `descripcion`, `como_se_arma` | Documentación del propio archivo |

Para ver exactamente qué se envía: `bash tools/run_python.sh -c "from content.generation.prompts import build_prompt; print(build_prompt(skill={'code':'PROG','name':'Programming','description':'...'}, level=3, level_title='Apply', item_type='coding', count=2, estimated_minutes=25, context=None))"` desde la raíz del proyecto.

#### 4.6.2 Log de las llamadas a la IA (solo desarrollo)

Sirve para **probar qué modelo usar y revisar a mano la calidad de las respuestas** al ajustar el prompt. Está **apagado por defecto y en producción debe quedar apagado**. Los prompts incluyen el contexto que escribe el docente, por eso `logs/` está en `.gitignore`.

| Qué | Cómo |
|---|---|
| Activarlo | `LOG_IA=1` en el `.env` (y reiniciar `content`). `LOG_IA_ETIQUETA` pone un nombre al experimento (por ejemplo `gpt-oss-vs-llama`) para agrupar corridas; `LOG_IA_DIR` cambia la carpeta (por defecto `logs/ia/`) |
| Qué guarda | Una línea JSON por **intento** (cada reintento es otra línea) en `logs/ia/AAAA-MM-DD.jsonl`: fecha, etiqueta, pedido (id que une los intentos y pasos de una misma generación), skill, nivel, tipo, cantidad, minutos, respuestas correctas pedidas, paso (`completo`, o `items` y `referencias` en los tipos abiertos), intento, **prompt completo**, **respuesta cruda**, si fue válida y por qué se rechazó, versión del prompt (`prompt.json`) y su huella, y los datos de la llamada que informa el módulo `llm` (proveedor, modelo, parámetros, tokens y duración; lo que no informa va como `--`) |
| Qué no guarda | El token del usuario ni ninguna cabecera |
| Dónde se engancha | `_ask` de `content/service.py` anota cada intento con `ai_log.registrar`. Un fallo al escribir el log nunca interrumpe la generación |
| Verlo | `bash tools/reporte_log_ia.sh` (con `--abrir`, además lo abre en el navegador) genera `logs/ia/visor.html` (solo lectura) con `tools/ver_log_ia.py`: tabla filtrable por etiqueta, modelo, tipo, paso y validez; al elegir un intento muestra el prompt, la respuesta, el motivo del rechazo y las respuestas de otros modelos para **el mismo caso** (skill, nivel, tipo, cantidad, paso y versión del prompt) |
| Quitarlo en producción | Dejar `LOG_IA=0` (o sin definir): no se escribe nada. Para eliminarlo del código basta borrar `ai_log.py`, `tools/ver_log_ia.py`, `tools/reporte_log_ia.sh` y las llamadas a `ai_log.registrar` en `_ask` |

La anotación de las respuestas (de acuerdo o en desacuerdo, por ítem) queda para más adelante, separada del log.

### 4.7 Scripts de operación

| Archivo | Qué hace |
|---|---|
| `tools/run.sh` | `bash tools/run.sh <módulo>`: prepara el entorno, carga `.env` y levanta el módulo con `uvicorn` en su puerto |
| `tools/run_all.sh` | Levanta los cuatro módulos y los portales que no estén corriendo (detecta por puerto), espera a que respondan, muestra su estado y el log en vivo, y con `Ctrl+C` detiene solo lo que inició. `--reiniciar` y `--detener` cierran lo que escuche en esos puertos. Los puertos se pueden cambiar con `PORT_IDENTITY`, `PORT_CATALOG`, `PORT_LLM`, `PORT_CONTENT` y `PORT_WEB` (para pruebas) |
| `tools/lib.sh` | `preparar_entorno`: crea el entorno virtual `sprint1` (virtualenvwrapper) e instala las dependencias si cambió `requirements.txt`. `cargar_env`: carga `.env`. `exportar_pythonpath`: pone en `PYTHONPATH` la raíz y las carpetas de los cinco módulos |
| `tools/run_python.sh` | Ejecuta un script Python con el entorno y `PYTHONPATH` correctos |
| `tools/reporte_log_ia.sh` | `bash tools/reporte_log_ia.sh [--abrir] [--carpeta ruta]`: genera el reporte del log de IA con `ver_log_ia.py` y, con `--abrir`, lo abre en el navegador (ver 4.6.2) |
| `tools/ver_log_ia.py` | Genera el visor HTML del log de IA a partir de `logs/ia/*.jsonl` (ver 4.6.2) |
| `db/setup.sh` | Crea el rol y la BD (necesita `sudo`), aplica `schema.sql` y carga el catálogo |

### 4.8 `db/` (base de datos)

| Archivo | Qué hace |
|---|---|
| `schema.sql` | Crea los schemas y las tablas (idempotente). Incluye los siete niveles SFIA |
| `seed_catalog.py` | `read(nombre)` lee un CSV; `seed_skills`, `seed_profiles` y `seed_profile_skills` insertan o actualizan por código/nombre; `main()` los ejecuta y muestra los totales. Se puede repetir sin duplicar |
| `data/skills.csv` | 147 skills con descripción, categoría, subcategoría y niveles mínimo y máximo |
| `data/role_profiles.csv` | 72 perfiles de rol con su familia |
| `data/role_profile_skills.csv` | 797 relaciones perfil–skill, con la marca de skill primaria |
| `migrations/001_*.sql` | Pasos aplicados a una BD ya creada: mover `min_level` a la skill y agregar `max_level` |
| `migrations/002_puntuacion_estrellas.sql` | Pasa `item_scores.score` a `smallint` de 1 a 5, redondeando las puntuaciones existentes |

### 4.9 Configuración (`.env`)

| Variable | Para qué |
|---|---|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Conexión a PostgreSQL |
| `JWT_SECRET`, `JWT_TTL_SECONDS` | Clave de firma compartida y duración del access token (3600 s) |
| `REFRESH_TTL_SECONDS` | Duración del refresh token (604800 s = 7 días) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET` | Login con Google |
| `PORTAL_DOCENTE_URL`, `PORTAL_VALIDADOR_URL`, `CORS_ORIGINS` | A dónde volver tras el login y qué origen puede llamar al backend |
| `CATALOG_URL`, `LLM_URL` | Direcciones entre módulos |
| `LLM_PROVIDER` | Quién responde: `groq` o `cli` |
| `GROQ_API_KEY`, `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`, `LLM_REASONING_EFFORT` | Proveedor Groq: clave, modelo (por defecto `openai/gpt-oss-120b`), tokens máximos de la respuesta (4096), temperatura (0.6) y esfuerzo de razonamiento de los modelos gpt-oss (`low`) |
| `LLM_CLI_COMMAND`, `LLM_CLI_CWD` | Solo con `cli`: comando de la IA y carpeta desde la que se lanza |
| `LLM_TIMEOUT_SECONDS` | Tiempo límite de cada pedido a la IA |
| `GROQ_BASE_URL` | Opcional (no está en `.env.example`): dirección de la API de Groq; por defecto `https://api.groq.com/openai/v1` |

---

## 5. Referencia del frontend, archivo por archivo

`web/` usa **Next.js** con **React** y **TypeScript**. En Next, cada carpeta de `src/app/` es una página. Los componentes que usan `useState` o `useEffect` llevan `"use client"` en la primera línea: eso significa que se ejecutan en el navegador.

### 5.1 `src/app/` (páginas)

| Archivo | Qué hace |
|---|---|
| `layout.tsx` | Estructura común de todas las páginas: título y estilos |
| `page.tsx` | Inicio (`/`): enlaces a los dos portales |
| `docente/page.tsx` | Página `/docente/`: muestra `docente/App` |
| `validador/page.tsx` | Página `/validador/`: muestra `validador/App` |

### 5.2 `src/shared/` (lo común a los dos portales)

| Archivo | Función / componente | Qué hace |
|---|---|---|
| `config.ts` | `IDENTITY_URL`, `CATALOG_URL`, `CONTENT_URL` | Direcciones de los módulos (se pueden cambiar con `NEXT_PUBLIC_*`) |
| `types.ts` | `Skill`, `Level`, `RoleProfile`, `ItemSummary`, `ItemDetailData`, `Box`, `Draft`… | Las formas de los datos que se mueven por la aplicación |
| `auth.ts` | `guardarTokenDeLaUrl(portal)` | Si la URL trae `#access_token=…&refresh_token=…`, los guarda y limpia la URL |
| | `leerToken(portal)` | Lee el access token guardado |
| | `cerrarSesion(portal)` | Revoca el refresh token en el servidor y borra los tokens locales |
| | `refrescarSesion(portal)` | Cambia el refresh token por un par nuevo. Devuelve `"ok"`, `"invalida"` o `"error"`. Comparte una sola renovación entre llamadas simultáneas |
| | `rolesDelToken(token)` | Lee los roles del JWT (sin verificar la firma: solo para elegir pantalla) |
| | `iniciarLogin(portal)` | Navega al login con Google |
| | `avisarSesionVencida`, `leerAvisoSesionVencida` | Dejan y leen el aviso "Tu sesión venció" para la pantalla de acceso |
| `api.ts` | `api(portal, url, opciones)` | Llama al backend con el JWT. Si responde 401, renueva la sesión y repite la llamada una vez (ver 3.2). Convierte los errores en `ApiError` |
| | `consulta(params)` | Arma `?a=1&b=2` omitiendo los valores vacíos |
| `LoginGate.tsx` | `LoginGate` | Pantalla de acceso de un portal: decide entre *cargando*, *sin sesión*, *no autorizado*, *sesión vieja* y el portal en sí |
| `ItemBrowser.tsx` | `ItemBrowser` | Banco de ítems: filtros (skill con `SkillPicker`, nivel de responsabilidad, tipo, puntuación y rango de promedio con `RangoEstrellas`…), lista paginada y detalle. Cada fila muestra el tipo con un icono (`IconoTipo`) y el nivel con el color de la categoría de la skill (`NivelChip`) en lugar de texto. En el modo docente cada ítem lleva la etiqueta «público» o «privado». Recibe `modo` (qué filtros ofrece) y `acciones` (botones propios de cada portal) |
| `SkillPicker.tsx` | `SkillPicker` | Menú para elegir una skill: categorías colapsables con sus subcategorías, buscador por código o nombre y, si se pasa `alLimpiar`, una opción «Todas las skills». Lo usan el Paso 1 (añadir y cambiar skill) y el filtro del banco |
| `Niveles.tsx` | `Niveles` | Los 7 niveles SFIA como celdas con el color de la categoría; con `alElegir` son botones y solo se pueden elegir los del rango de la skill |
| | `NivelChip` | Un solo nivel como celda con el color de la categoría, para listas compactas (banco y revisión) |
| `IconoTipo.tsx` | `IconoTipo`, `COLOR_TIPO` | Icono (`tipo-<tipo>.svg`) y color de cada uno de los seis tipos de ítem; el título del icono es el nombre del tipo |
| `Ayuda.tsx` | `Ayuda` | Texto subrayado con puntos que muestra una explicación o ejemplo al pasar el cursor o al enfocarlo con el teclado |
| `Estrellas.tsx` | `Icono` | Dibuja un `.svg` de `public/icons/` (tipos de ítem, acciones y estrellas) con el color del texto (máscara CSS) |
| | `Estrellas`, `SelectorEstrellas` | Cinco estrellas con el promedio redondeado, y el selector de 1 a 5 estrellas del validador |
| `RangoEstrellas.tsx` | `RangoEstrellas` | Barra con dos puntos (mínimo y máximo, de 1 a 5) para filtrar por promedio |
| `categorias.ts` | `colorDe`, `agruparSkills` | Color de cada categoría SFIA y agrupado de las skills por categoría y subcategoría |
| `ItemDetail.tsx` | `ItemDetail` | Muestra los atributos de un ítem: cabecera con skill, nivel, tiempo y puntuación, y el contenido con `VistaItem` (el banco del docente y el portal del experto se ven igual que un borrador; el marco interno se titula «Solo para el docente/reclutador») |
| `VistaItem.tsx` | `VistaItem`, `Rubrica` | Un ítem completo, separado en lo que verá quien rinda (marco azul, con el título de cada dato) y lo que solo ve el docente/reclutador (marco punteado), con la rúbrica como matriz. Lo usan la revisión de borradores, el banco y el portal del experto |
| | `ContenidoDelTipo` | La parte que cambia según el tipo (opciones, firma, escenario, síntoma…) |
| | `Puntuacion` | Muestra cinco estrellas con el promedio y la cantidad; si el ítem no tiene puntuaciones muestra una estrella tachada |
| | `NOMBRE_TIPO` | Nombre legible de cada tipo |

### 5.3 `src/docente/` (Portal Docente/Reclutador)

| Archivo | Función / componente | Qué hace |
|---|---|---|
| `App.tsx` | `App` | Barra con *Generar ítems*, *Banco de ítems* y *Catálogo SFIA ↗*. En el banco, agrega el botón de activar/desactivar |
| `GenerateView.tsx` | `GenerateView` | Orquesta los pasos: evaluar → resumen → generando → revisión → publicado |
| | `pedir(g)` | Un pedido `POST /drafts` para un grupo (recuadro × tipo) |
| | `generar(lista)` | Lanza los pedidos en paralelo (3 a la vez) y arma la lista de borradores y de fallos |
| | `reiniciar`, `olvidarTrabajo` | Empezar de cero y borrar el trabajo guardado |
| `StepEvaluar.tsx` | `StepEvaluar` | Paso 1: añadir skills (una a una o desde un rol), recuadros por skill (nivel, contexto, tipos, cantidad y minutos por ítem). `MINUTOS_POR_TIPO` define los minutos que se proponen para cada tipo. Los tipos se listan con su icono; «Cantidad» y «Tiempo (min)» son títulos de columna que aparecen una sola vez, y esos títulos y cada tipo muestran al pasar el cursor una explicación con un ejemplo (`Ayuda`; textos en `DESCRIPCION_TIPO`, `TEXTO_CANTIDAD` y `TEXTO_MINUTOS` de `tipos.ts`). La skill y su nivel de responsabilidad van en la misma fila y el paso ocupa el ancho de la plataforma (como el resumen, la pantalla «Generando…» y «Publicación lista»: todas las secciones de página completa usan la clase `pagina`; solo el acceso con Google es angosto). Un recuadro minimizado (`ResumenCompacto`) muestra el nivel y, por cada tipo, su icono, la cantidad y los minutos; si no tiene ningún tipo marcado lo dice en rojo |
| `RolPicker.tsx` | `RolPicker`, `nombreFamilia` | Ventana para elegir un rol por familia, ver sus skills core y related y añadir las elegidas al formulario (tarjetas que se rellenan con el color de la categoría). `nombreFamilia` convierte «AGILE DELIVERY ROLE FAMILY» en «Agile delivery» |
| | `nuevoBox`, `ResumenCompacto`, `ajustarContador` | Crea un recuadro; lo resume (minimizado y en el Paso 2); evita claves repetidas al recuperar trabajo guardado |
| `ReviewView.tsx` | `ReviewView` | Paso 3: lista de borradores a la izquierda, el elegido completo a la derecha (encabezado fijo «Borrador N de M» con editar, regenerar y descartar como iconos), botón «Volver» y pie de publicación |
| | `regenerar(d)` | Regenera un borrador con comentario opcional |
| | `publicar()` | Agrupa y envía los borradores a `POST /items/publish` |
| | `limpiar(c)` | Quita lo que el usuario dejó vacío antes de publicar |
| `DraftEditor.tsx` | `DraftEditor` | Formulario de edición según el tipo del borrador. En la rúbrica, los criterios fijos del tipo están bloqueados y los demás se pueden editar, quitar (si quedan al menos 4) y agregar |
| | `Opciones`, `Hallazgos`, `Rubrica`, `Lineas`, `Texto`, `Numero` | Campos reutilizables; la rúbrica muestra la suma de pesos y avisa si no es 100 |
| `tipos.ts` | `OPEN_TYPES`, `CRITERIOS_FIJOS` | Tipos que llevan rúbrica y sus criterios fijos con sus 4 descriptores, importados de `config/criterios-fijos.json` (el mismo archivo que lee el backend) |
| | `DESCRIPCION_TIPO`, `TEXTO_CANTIDAD`, `TEXTO_MINUTOS` | Textos de la ayuda al pasar el cursor del formulario de generación |

### 5.4 `src/validador/` (Portal Validador)

| Archivo | Componente | Qué hace |
|---|---|---|
| `App.tsx` | `App` | Muestra `ItemBrowser` en modo validador (con filtro por rol) y le agrega el formulario de puntuación |
| `ScoreForm.tsx` | `ScoreForm` | Selector de 1 a 5 estrellas y botón *Puntuar* / *Actualizar puntuación* |

### 5.5 Estado de un portal en el navegador

| Dónde | Qué se guarda |
|---|---|
| `localStorage` · `sprint1_token_<portal>` | Access token |
| `localStorage` · `sprint1_refresh_<portal>` | Refresh token |
| `localStorage` · `sprint1_aviso_<portal>` | Aviso de sesión vencida (se lee una vez) |
| `localStorage` · `sprint1_borradores_docente` | Trabajo sin publicar del generador |

---

## 6. Base de datos

Un schema por módulo, como en `docs/architecture/db.dbml`. `content` depende de `catalog` e `identity` (claves foráneas físicas); estos dos no dependen de nadie.

| Schema | Tabla | Para qué sirve | Quién la escribe |
|---|---|---|---|
| `identity` | `users` | Usuarios (correo, nombre, `google_id`) | `identity` al iniciar sesión; `grant_role` (provisionales) |
| | `user_roles` | **Lista blanca**: qué rol tiene cada usuario | `identity/grant_role.py` |
| | `refresh_tokens` | Refresh tokens (solo el hash), vencimiento y revocación | `identity` |
| `catalog` | `skills` | Skills SFIA con categoría, subcategoría y niveles mínimo y máximo | `db/seed_catalog.py` |
| | `levels` | Niveles 1 a 7 | `db/schema.sql` |
| | `role_profiles`, `role_profile_skills` | Perfiles de rol y sus skills (con marca de primaria) | `db/seed_catalog.py` |
| `content` | `generation_requests` | Un pedido por skill, nivel, tipo y tiempo, guardado al publicar | `content` al publicar |
| | `items` | Identidad del ítem: estado, skill, autor y disponibilidad para expertos | `content` |
| | `item_versions` | Contenido de cada versión: tipo, versión, origen, nivel, tiempo, enunciado | `content` |
| | `item_choice_options`, `item_true_false`, `item_open_question`, `item_coding`, `item_system_design`, `item_debugging`, `item_findings` | Datos propios de cada tipo | `content` |
| | `rubric_criteria`, `rubric_levels` | Rúbrica de los tipos abiertos | `content` |
| | `item_scores` | Puntuación de cada validador sobre una versión | `content` |
| `events` | `events` | Registro de eventos de dominio | todos, con `emit_event` |

**Eventos que se registran hoy:** `UserRegistered`, `ItemVersionCreated`, `ItemScored` e `ItemDeactivated`.

---

## 7. Pruebas

Se ejecutan con `bash tools/run_python.sh -m pytest`. Usan la BD real y reemplazan la IA por respuestas controladas; los datos de prueba (correos `@test.sprint1.local`) se borran al terminar.

| Archivo | Qué prueba |
|---|---|
| `tests/conftest.py` | Utilidades: `make_user` (crea un usuario con roles y su JWT), `_cleanup` (borra lo creado por las pruebas) y los clientes de cada módulo. `fake_llm` reemplaza la llamada a la IA |
| `tests/helpers.py` | `borradores`, `publicar` y `generar`: reproducen lo que hace el portal (pedir borradores y luego publicar) |
| `tests/samples.py` | Una respuesta válida de la IA para cada tipo de ítem |
| `tests/test_criterios_aceptacion.py` | **Un test por criterio de aceptación** de las 16 historias. Cada nombre y su docstring citan el criterio (por ejemplo `test_hu05_c4_…`). Los criterios que solo existen en pantalla se marcan "E2E" |
| `tests/test_identity.py` | Login, roles y lista blanca |
| `tests/test_refresh.py` | Renovación, rotación, vencimiento y cierre de sesión |
| `tests/test_catalog.py` | Skills, niveles, perfiles y niveles mínimo/máximo |
| `tests/test_refinamiento_generacion.py` | Refinamiento de la generación: balanceo de correctas, posición exigida, regenerar, opciones que dependen de otras, dos pasos en los tipos abiertos, rúbrica de 4 criterios con los fijos del archivo `config/criterios-fijos.json` y criterios agregados a mano |
| `tests/test_content.py` | Generación, validaciones, edición antes de publicar, visibilidad, filtros, estado y puntuación, y la plantilla del prompt (`prompt.json`: descripción completa, frases opcionales y los seis tipos) |
| `tests/test_llm.py` | El módulo `llm`: la CLI y Groq (con respuestas simuladas: clave, errores, reintentos con `retry-after`, respuesta cortada y tiempo agotado) y los datos de la llamada que devuelve `/ask` (modelo, tokens y parámetros, o `--` si el proveedor no los informa) |
| `tests/test_log_ia.py` | El log de IA: apagado por defecto, una línea por intento y por paso, reintentos con su error, datos de la llamada, que no guarde el token y que un fallo del log no rompa la generación |

**Pruebas de navegador** (`tests/e2e/`, con Playwright y Chromium):

| Archivo | Qué hace |
|---|---|
| `run_e2e.sh` | Levanta su propia copia de los módulos y del portal en otros puertos (9001–9004 y 5199) con una IA simulada, ejecuta los guiones y limpia. **No toca lo que tengas corriendo** |
| `generar.mjs` | Recorre el generador completo: rol SFIA, menú de skills con buscador, niveles, altura de los recuadros, contexto por skill, borradores, edición, tiempo por ítem, descarte, regeneración, publicación y banco (etiquetas público/privado, filtros de skill y nivel) |
| `sesion.mjs` | Siete escenarios de sesión: renovación automática, refresh inválido, rol nuevo, vencimiento a mitad de uso, cierre de sesión, red caída y recuperación de borradores |
| `fake_llm_cli.py` | La IA simulada |
| `make_token.py` | Crea usuarios y sesiones de prueba |

Cada paso de las pruebas de navegador lleva entre corchetes la historia y el criterio que cubre, por ejemplo `[HU-30 c2] restaurar lo devuelve a 3`.

---

## 8. Cómo ejecutar todo

**Una sola vez**

```
cd <raíz del proyecto>
cp .env.example .env            # y completar los valores
bash db/setup.sh                # crea la BD y carga el catálogo (pide sudo)
bash tools/run_python.sh modules/identity/identity/grant_role.py <correo> teacher_recruiter validator
```

**Cada vez**, con un solo comando:

```
bash tools/run_all.sh               # inicia lo que falte; omite lo que ya corre; Ctrl+C detiene lo que inició
bash tools/run_all.sh --reiniciar   # detiene y vuelve a iniciar todo (úsalo tras cambiar código)
bash tools/run_all.sh --detener     # detiene todo
```

Muestra una tabla con el estado de cada módulo, los dos enlaces de los portales y el log en vivo de lo que inició (cada línea con el prefijo `[módulo]`). Los logs quedan en `tools/logs/`. Avisa si PostgreSQL no responde o si falta `GROQ_API_KEY`.

O, si prefieres una terminal por módulo:

```
bash tools/run.sh identity            # :8001
bash tools/run.sh catalog             # :8002
bash tools/run.sh llm                 # :8003  (con LLM_PROVIDER=groq necesita GROQ_API_KEY en el .env)
bash tools/run.sh content             # :8004
bash web/management-portal/run.sh                 # :5173  → /docente/  y  /validador/
```

`uvicorn` y `next dev` desde `/mnt/c` **no siempre recargan solos**: después de cambiar código, reinicia el módulo.

**Pruebas**

```
bash tools/run_python.sh -m pytest        # backend
bash tests/e2e/run_e2e.sh                   # navegador
```

---

## 9. Reglas de negocio y límites conocidos

### Quién ve qué

| Usuario | Lista de ítems | Detalle | Puede |
|---|---|---|---|
| `teacher_recruiter` | Los **suyos** (también privados) y los disponibles para expertos, activos o inactivos | Los mismos | Generar, publicar, activar/desactivar |
| `validator` | Solo ítems **activos y disponibles para expertos** | Los mismos | Puntuar |
| Cualquiera sin rol | Nada: 403 | — | — |

Un ítem de **uso privado** solo lo ve su autor; otro docente tampoco lo ve.

### Reglas que valida `schemas.py` (lo generado y lo editado)

- Todos los textos obligatorios tienen contenido.
- **Alternativa única:** al menos 2 opciones, exactamente 1 correcta, sin repetidas. Solo al generar con la IA se exige además que sean 4 opciones, que la correcta esté en la posición pedida y que una opción que dependa de otras («todas las anteriores», «A y B») vaya únicamente en la última posición; lo que edita el docente no se limita por esto.
- **Coding:** límites de tiempo y memoria mayores que 0; si hay código inicial, debe contener la función de la firma.
- **System design:** al menos un requisito funcional.
- **Debugging:** al menos un hallazgo; lo observado distinto de lo esperado; cada línea indicada existe en el código.
- **Tipos abiertos (desarrollo, system design, debugging):** rúbrica de **al menos 4 criterios**, con los 2 criterios fijos del tipo, **pesos que suman 100**, nombres no repetidos y un descriptor para cada puntaje 0, 1, 2 y 3. Lo que genera la IA tiene exactamente 4 criterios de peso 25 (2 fijos y 2 propios); quien revisa o edita puede agregar más.

### Puntuación

- De 1 a 5 estrellas **enteras** (no hay medias estrellas). Un validador tiene **una** puntuación por versión (si vuelve a puntuar, la reemplaza).
- El promedio se redondea a un decimal. **Sin puntuar** (promedio vacío y cantidad 0) es distinto de cualquier promedio: el portal muestra una estrella tachada en el primer caso y las estrellas con el promedio en el segundo.

### Límites conocidos

- La regla "la solución de referencia de un coding debe pasar sus tests en un contenedor aislado" **no se valida**: corresponde a HU-21.
- `generation_requests.status` admite `pending`, `completed` y `failed`, pero solo se guarda `completed`: los pedidos fallidos no se guardan.
- El borrador vive en el navegador: si se cambia de navegador o equipo, no se recupera.
- Si un refresh token ya usado se presenta de nuevo, solo se rechaza con 401; no se revocan las demás sesiones del usuario.
- Los ítems publicados quedan en versión 1. Modificarlos o regenerarlos después (HU-13, HU-14, HU-26) está en el Backlog.
- La generación con Groq se validó contra el servidor real en los seis tipos de ítem (`llm/probar.py --generacion`); falta revisar desde el portal la calidad de lo generado. Las pruebas automáticas usan una IA simulada.
- **Límites del plan gratuito de Groq:** tokens por minuto y por día. Un pedido grande (muchos ítems, o tipos largos como coding) puede quedar corto con `LLM_MAX_TOKENS` o agotar la cuota; el portal lo muestra como un error del pedido y se puede reintentar.
