# Diccionario de tipos de ítem

> Las tablas corresponden al modelo `db.dbml` (tabla base más extensiones). Supuestos aún sin confirmar: los códigos de skill de los ejemplos son ilustrativos.

## 1. Convenciones

- Cada ítem trata **una sola skill SFIA** (regla de negocio). Cada versión pertenece a **un solo tipo**, y el tipo puede cambiar al regenerar el ítem.
- Hay seis tipos: `single_choice`, `true_false`, `open_question`, `coding`, `system_design` y `debugging`.
- Las **preguntas cerradas** son `single_choice` y `true_false`. Se corrigen automáticamente por comparación exacta.
- Los **tipos abiertos** son `open_question`, `system_design` y `debugging`. Son los únicos que llevan rúbrica. Los demás no la tienen.
- Todo ítem tiene un campo `evaluation_goal` (qué busca evaluar).
- Un ítem nuevo nace `active` y sin puntuar. Al publicarlo, su autor decide si queda disponible para expertos (`available_to_experts`) o de uso privado.
- Schemas: las tablas de este documento pertenecen al schema `content`. Sus FK físicas apuntan a `catalog.skills`, `catalog.levels` e `identity.users`. En el texto se nombran sin el prefijo del schema.
- Las **reglas de negocio que la base de datos no cubre** (secciones 2.4 y 3.3, y las de cada tipo) las valida la aplicación antes de guardar. Una versión se guarda con todo su contenido en una única transacción.
- Notación de la columna **Clave**: `PK` clave primaria, `FK → tabla.columna` clave foránea, `UQ` valor único, `NN` no nulo (si no se indica `NN`, la columna admite nulos).
- En los ejemplos, `skill_id`, `created_by` y `level` se muestran con un valor legible (código de skill, usuario) en lugar del identificador real.

## 2. Tablas comunes a todos los tipos

### 2.1 `items` — identidad del ítem

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador del ítem |
| `status` | varchar | NN | `active` o `inactive` |
| `skill_id` | uuid | FK → `skills.id`, NN | Skill SFIA que evalúa. No cambia entre versiones |
| `created_by` | uuid | FK → `users.id`, NN | Quién lo creó |
| `available_to_experts` | boolean | NN | `true`: los validadores pueden verlo y puntuarlo; `false`: uso privado, solo lo ve su autor |
| `created_at` | timestamptz | NN | Creación |

### 2.2 `item_versions` — contenido de cada versión

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador de la versión |
| `item_id` | uuid | FK → `items.id`, NN | Ítem al que pertenece |
| `type` | varchar | NN | Tipo de la versión: uno de los seis tipos. Puede cambiar respecto de la versión anterior solo si `origin` es `regenerated` |
| `version` | int | NN | 1, 2, 3… Único por ítem (`UQ(item_id, version)`) |
| `origin` | varchar | NN | Cómo se originó esta versión: `generated` (generada por la IA a partir de un pedido de generación), `regenerated` (regenerada con IA con un nuevo contexto) o `edited` (modificada manualmente) |
| `generation_request_id` | uuid | FK → `generation_requests.id` | Pedido de generación o de regeneración que originó la versión. Vacío si `origin` es `edited` |
| `level` | smallint | FK → `levels.level`, NN | Nivel de responsabilidad SFIA, de 1 a 7 |
| `estimated_minutes` | int | NN | Tiempo estimado de resolución |
| `evaluation_goal` | text | NN | Qué busca evaluar el ítem |
| `statement` | text | NN | Enunciado |
| `created_at` | timestamptz | NN | Creación de la versión |

### 2.3 Cómo se conectan las tablas

```
items (id)
  └─ item_versions (id, item_id → items.id, type)
        ├─ item_choice_options        (item_version_id → item_versions.id)   single_choice
        ├─ item_true_false            (item_version_id → item_versions.id)   true_false
        ├─ item_open_question         (item_version_id → item_versions.id)   open_question
        ├─ item_coding                (item_version_id → item_versions.id)   coding
        ├─ item_system_design         (item_version_id → item_versions.id)   system_design
        ├─ item_debugging             (item_version_id → item_versions.id)   debugging
        ├─ item_findings              (item_version_id → item_versions.id)   debugging
        └─ rubric_criteria            (item_version_id → item_versions.id)   tipos abiertos
              └─ rubric_levels        (criterion_id → rubric_criteria.id)
```


### 2.4 Reglas de negocio comunes que la base de datos no cubre

Estas reglas las valida la aplicación al guardar. Las restricciones simples (valores positivos, rangos numéricos) se declaran como `CHECK` en la base de datos y no se listan aquí.

1. Los textos obligatorios (`NN`) deben tener contenido: no pueden ser vacíos ni contener solo espacios.
2. Una versión `edited` conserva el `type` de la versión anterior: la modificación manual no cambia de tipo. Solo una regeneración puede hacerlo, y entonces la versión nueva trae su propio contenido, con la tabla de su tipo y, si es abierto, su rúbrica.
3. Una versión se crea junto con todo su contenido: su fila en la tabla de su tipo (y solo en esa) y, según el tipo, sus opciones, hallazgos y rúbrica. No existen versiones a medias.
4. Los números de versión de un ítem son consecutivos desde 1.
5. Una versión no se modifica una vez creada. Todo cambio crea una versión nueva, que copia el contenido anterior con los cambios aplicados y parte sin puntuaciones.
6. `origin`: la versión 1 es siempre `generated`; las versiones siguientes son `regenerated` o `edited`. Las versiones `generated` y `regenerated` tienen `generation_request_id`; las `edited` no.
7. `items.skill_id` no cambia entre versiones. El pedido de generación o regeneración de una versión tiene la skill del ítem y el tipo de esa versión; en la versión 1, también su nivel.
8. Un ítem `inactive` no se muestra ni se usa en evaluaciones nuevas. No se borra: conserva sus versiones y puntuaciones.

### 2.5 `generation_requests` — pedido de generación o de regeneración

Guarda el contexto con el que la IA generó (HU-04 y HU-06) o regeneró (HU-14) un ítem. Una regeneración crea un pedido nuevo. Los borradores se generan sin guardarse; el pedido se guarda al publicarlos, uno por skill, nivel, tipo y tiempo.

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador del pedido |
| `requested_by` | uuid | FK → `users.id`, NN | Quién lo pidió |
| `skill_id` | uuid | FK → `skills.id`, NN | Skill pedida |
| `level` | smallint | FK → `levels.level`, NN | Nivel de responsabilidad pedido |
| `item_type` | varchar | NN | Tipo de ítem pedido |
| `item_count` | int | NN | Cantidad de ítems publicados con este pedido (1 en una regeneración) |
| `estimated_minutes` | int | NN | Tiempo estimado pedido |
| `context` | text | | Texto de contexto indicado por el usuario. Se usa al regenerar un ítem |
| `status` | varchar | NN | Estado del pedido. Se guarda `completed`: los pedidos que la IA no pudo resolver no se guardan |
| `created_at` | timestamptz | NN | Creación |

**Ejemplo**

| id | requested_by | skill_id | level | item_type | item_count | estimated_minutes | context | status | created_at |
|---|---|---|---|---|---|---|---|---|---|
| g1 | u1 | PROG | 3 | single_choice | 5 | 10 | NULL | completed | 2026-10-22 09:55 |
| g7 | u1 | PROG | 3 | single_choice | 1 | 2 | Orientar la pregunta a un caso de bases de datos | completed | 2026-10-23 11:00 |

`g1` es un pedido inicial. `g7` es una regeneración: la versión 2 del ítem `i1` apuntaría a `g7`. Los pedidos `g2` a `g6` de los demás ejemplos no se muestran.

## 3. Rúbrica (tipos abiertos: `open_question`, `system_design` y `debugging`)

La rúbrica solo existe para los tres tipos abiertos. Cuelga de la versión del ítem.

### 3.1 `rubric_criteria` — un criterio de evaluación

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador del criterio |
| `item_version_id` | uuid | FK → `item_versions.id`, NN | Versión del ítem a la que pertenece |
| `name` | varchar | NN | Nombre del criterio |
| `weight` | smallint | NN | Peso del criterio. Los pesos de una versión suman 100 |
| `position` | smallint | NN | Orden de aparición |

### 3.2 `rubric_levels` — descriptor de cada puntaje de un criterio

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `criterion_id` | uuid | PK, FK → `rubric_criteria.id` | Criterio al que pertenece |
| `score` | smallint | PK | Puntaje del nivel: 0, 1, 2 o 3 |
| `descriptor` | text | NN | Qué debe cumplir la respuesta para obtener ese puntaje |

La clave primaria es `(criterion_id, score)`: cada criterio tiene un único descriptor por puntaje.

**Puntaje del ítem (0 a 100)** = suma, sobre todos los criterios, de `weight × (score obtenido ÷ 3)`.

### 3.3 Reglas de negocio de la rúbrica que la base de datos no cubre

1. Solo las versiones de tipos abiertos tienen criterios. Las versiones de `single_choice`, `true_false` y `coding` no deben tener ninguno.
2. Toda versión de un tipo abierto debe tener al menos un criterio.
3. Los pesos de los criterios de una versión suman exactamente 100.
4. Cada criterio tiene exactamente cuatro descriptores, uno por cada puntaje 0, 1, 2 y 3.
5. Los nombres de los criterios no se repiten dentro de una versión, y sus posiciones son consecutivas desde 1.
6. Desde el refinamiento del Sprint 1, lo que publica la plataforma tiene al menos 4 criterios y sus pesos suman 100. Los 2 primeros son fijos según el tipo, con descriptores estáticos definidos en `config/criterios-fijos.json` (pregunta de desarrollo: «Precisión conceptual» y «Claridad y estructura»; system design: «Cumplimiento de requisitos funcionales y no funcionales» y «Justificación de decisiones y trade-offs»; debugging: «Identificación de la causa raíz» y «Corrección propuesta»). Lo que genera la IA tiene exactamente 4 criterios de peso 25: los fijos más 2 que escribe la IA según el problema. Quien revisa o edita puede agregar más criterios, pero no modificar los fijos. Los ítems anteriores conservan su rúbrica.

## 4. `single_choice` — Alternativa única

**Qué es:** pregunta con varias opciones y exactamente una correcta.
**Corrección:** automática, comparación exacta con la opción correcta. Sin rúbrica.

### Tabla `item_choice_options` (una fila por opción)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador de la opción |
| `item_version_id` | uuid | FK → `item_versions.id`, NN | Versión del ítem a la que pertenece |
| `position` | smallint | NN | Orden de la opción |
| `text` | text | NN | Texto de la opción |
| `is_correct` | boolean | NN | Verdadero en una única opción por versión |

### Reglas de negocio que la base de datos no cubre

1. Tiene al menos dos opciones.
2. Exactamente una opción tiene `is_correct` verdadero.
3. Las posiciones de las opciones son consecutivas desde 1 y sus textos no se repiten.

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i1 | active | PROG | u1 | true | 2026-10-22 10:00 |

**`item_versions`** (fila `v1`)

| Columna | Valor |
|---|---|
| id | v1 |
| item_id | i1 |
| type | single_choice |
| version | 1 |
| origin | generated |
| generation_request_id | g1 |
| level | 3 |
| estimated_minutes | 2 |
| evaluation_goal | Reconocer la complejidad temporal de la búsqueda binaria. |
| statement | ¿Cuál es la complejidad temporal de la búsqueda binaria en un arreglo ordenado de n elementos? |
| created_at | 2026-10-22 10:00 |

**`item_choice_options`**

| id | item_version_id | position | text | is_correct |
|---|---|---|---|---|
| o1 | v1 | 1 | O(n) | false |
| o2 | v1 | 2 | O(log n) | true |
| o3 | v1 | 3 | O(n log n) | false |
| o4 | v1 | 4 | O(1) | false |

## 5. `true_false` — Verdadero o falso

**Qué es:** afirmación que se debe juzgar como verdadera o falsa.
**Corrección:** automática, comparación exacta. Sin rúbrica.

### Tabla `item_true_false` (una fila por versión)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `item_version_id` | uuid | PK, FK → `item_versions.id` | Versión del ítem a la que pertenece |
| `correct_answer` | boolean | NN | Respuesta correcta: verdadero o falso |

### Reglas de negocio que la base de datos no cubre

Ninguna además de las comunes (sección 2.4).

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i2 | active | TEST | u1 | true | 2026-10-22 10:05 |

**`item_versions`** (fila `v2`)

| Columna | Valor |
|---|---|
| id | v2 |
| item_id | i2 |
| type | true_false |
| version | 1 |
| origin | generated |
| generation_request_id | g2 |
| level | 3 |
| estimated_minutes | 1 |
| evaluation_goal | Entender qué garantiza un test unitario. |
| statement | Un test unitario que pasa garantiza que el módulo no tiene errores. |
| created_at | 2026-10-22 10:05 |

**`item_true_false`**

| item_version_id | correct_answer |
|---|---|
| v2 | false |

## 6. `open_question` — Pregunta de desarrollo

**Qué es:** pregunta conceptual que el postulante responde con un texto redactado por él.
**Corrección:** recomendación con LLM-as-judge basada en la rúbrica, con revisión manual posible. Rúbrica obligatoria.

### Tabla `item_open_question` (una fila por versión)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `item_version_id` | uuid | PK, FK → `item_versions.id` | Versión del ítem a la que pertenece |
| `reference_answer` | text | NN | Respuesta de referencia (puntos esperados) |

Además usa `rubric_criteria` y `rubric_levels` (sección 3).

### Reglas de negocio que la base de datos no cubre

1. Debe tener rúbrica, con al menos un criterio (sección 3.3).

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i3 | active | TEST | u1 | true | 2026-10-22 10:10 |

**`item_versions`** (fila `v3`)

| Columna | Valor |
|---|---|
| id | v3 |
| item_id | i3 |
| type | open_question |
| version | 1 |
| origin | generated |
| generation_request_id | g3 |
| level | 3 |
| estimated_minutes | 10 |
| evaluation_goal | Explicar con precisión la diferencia entre pruebas unitarias y de integración. |
| statement | Explica la diferencia entre una prueba unitaria y una prueba de integración, y cuándo conviene usar cada una. |
| created_at | 2026-10-22 10:10 |

**`item_open_question`**

| Columna | Valor |
|---|---|
| item_version_id | v3 |
| reference_answer | La prueba unitaria verifica una unidad aislada (función o clase) con dependencias simuladas; es rápida y localiza fallos con precisión. La de integración verifica la interacción entre componentes reales (por ejemplo, servicio y base de datos); es más lenta y detecta errores de contrato. Se usan las unitarias para la lógica y las de integración para las fronteras entre componentes. |

**`rubric_criteria`**

| id | item_version_id | name | weight | position |
|---|---|---|---|---|
| c1 | v3 | Precisión conceptual | 25 | 1 |
| c2 | v3 | Claridad y estructura | 25 | 2 |
| c3 | v3 | Criterio de uso | 25 | 3 |
| c4 | v3 | Uso de ejemplos | 25 | 4 |

**`rubric_levels`**

| criterion_id | score | descriptor |
|---|---|---|
| c1 | 0 | Los conceptos son incorrectos o no aparecen. |
| c1 | 1 | Menciona los conceptos principales con errores o imprecisiones importantes. |
| c1 | 2 | Explica correctamente los conceptos principales. |
| c1 | 3 | Explica con precisión todos los conceptos relevantes y sus relaciones. |
| c2 | 0 | La respuesta es incomprensible o está desorganizada. |
| c2 | 1 | Se entiende, pero con ambigüedades o sin un orden claro. |
| c2 | 2 | Redacción clara y ordenada. |
| c2 | 3 | Redacción clara, bien estructurada y fácil de seguir de principio a fin. |
| c3 | 0 | No indica cuándo usar cada una. |
| c3 | 1 | Indica el uso de una de ellas. |
| c3 | 2 | Indica cuándo usar cada una. |
| c3 | 3 | Indica cuándo usar cada una y los costos de cada elección. |
| c4 | 0 | No ilustra los conceptos. |
| c4 | 1 | Menciona un ejemplo genérico. |
| c4 | 2 | Ilustra con un ejemplo pertinente. |
| c4 | 3 | Ilustra cada concepto con un ejemplo pertinente. |

## 7. `coding` — Coding challenge

**Qué es:** el postulante escribe código que resuelve un problema.
**Corrección:** el código se ejecuta contra tests unitarios en un contenedor aislado. Sin rúbrica.

### Tabla `item_coding` (una fila por versión)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `item_version_id` | uuid | PK, FK → `item_versions.id` | Versión del ítem a la que pertenece |
| `language` | varchar | NN | Lenguaje de programación (texto libre) |
| `function_signature` | text | NN | Firma de la función a implementar |
| `starter_code` | text | | Código inicial entregado al postulante |
| `unit_tests` | text | NN | Tests unitarios de corrección |
| `time_limit_seconds` | int | NN | Tiempo máximo de ejecución |
| `memory_limit_mb` | int | NN | Memoria máxima |
| `reference_solution` | text | NN | Solución de referencia |

### Reglas de negocio que la base de datos no cubre

1. `reference_solution` debe pasar todos los `unit_tests`, ejecutados en el contenedor aislado, para que la versión quede guardada.
2. Si hay `starter_code`, debe contener la función indicada en `function_signature`.
3. `language` es texto libre, sin lista cerrada. La aplicación comprobará si la IA puede generar el ítem en ese lenguaje (regla por definir).
4. No tiene rúbrica (sección 3.3).

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i4 | active | PROG | u1 | true | 2026-10-22 10:15 |

**`item_versions`** (fila `v4`)

| Columna | Valor |
|---|---|
| id | v4 |
| item_id | i4 |
| type | coding |
| version | 1 |
| origin | generated |
| generation_request_id | g4 |
| level | 3 |
| estimated_minutes | 20 |
| evaluation_goal | Implementar un algoritmo con tablas hash y manejar casos borde. |
| statement | Dada una lista de enteros y un objetivo, retorna los índices de dos números que suman el objetivo. Retorna None si no existe ningún par. |
| created_at | 2026-10-22 10:15 |

**`item_coding`**

| Columna | Valor |
|---|---|
| item_version_id | v4 |
| language | python |
| function_signature | def two_sum(nums: list[int], target: int) -> tuple[int, int] &#124; None |
| starter_code | def two_sum(nums, target):<br>&nbsp;&nbsp;&nbsp;&nbsp;pass |
| unit_tests | def test_basic():<br>&nbsp;&nbsp;&nbsp;&nbsp;assert two_sum([2, 7, 11, 15], 9) == (0, 1)<br><br>def test_none():<br>&nbsp;&nbsp;&nbsp;&nbsp;assert two_sum([1, 2], 10) is None<br><br>def test_duplicates():<br>&nbsp;&nbsp;&nbsp;&nbsp;assert two_sum([3, 3], 6) == (0, 1) |
| time_limit_seconds | 2 |
| memory_limit_mb | 128 |
| reference_solution | def two_sum(nums, target):<br>&nbsp;&nbsp;&nbsp;&nbsp;seen = {}<br>&nbsp;&nbsp;&nbsp;&nbsp;for i, n in enumerate(nums):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if target - n in seen:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return (seen[target - n], i)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;seen[n] = i<br>&nbsp;&nbsp;&nbsp;&nbsp;return None |

## 8. `system_design` — Diseño de sistemas

**Qué es:** el postulante diseña la arquitectura de un sistema a partir de un escenario y requisitos.
**Corrección:** recomendación con LLM-as-judge basada en la rúbrica, con revisión manual posible. Rúbrica obligatoria.

### Tabla `item_system_design` (una fila por versión)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `item_version_id` | uuid | PK, FK → `item_versions.id` | Versión del ítem a la que pertenece |
| `scenario` | text | NN | Contexto del sistema a diseñar |
| `functional_requirements` | text[] | | Lista de requisitos funcionales |
| `non_functional_requirements` | text[] | | Lista de requisitos no funcionales |
| `constraints` | text[] | | Lista de restricciones |
| `reference_answer` | text | NN | Respuesta de referencia (puntos esperados) |

Además usa `rubric_criteria` y `rubric_levels` (sección 3).

### Reglas de negocio que la base de datos no cubre

1. Debe tener al menos un requisito funcional.
2. Debe tener rúbrica, con al menos un criterio (sección 3.3).

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i5 | active | ARCH | u1 | true | 2026-10-22 10:20 |

**`item_versions`** (fila `v5`)

| Columna | Valor |
|---|---|
| id | v5 |
| item_id | i5 |
| type | system_design |
| version | 1 |
| origin | generated |
| generation_request_id | g5 |
| level | 5 |
| estimated_minutes | 40 |
| evaluation_goal | Diseñar un sistema escalable justificando almacenamiento, caché y trade-offs. |
| statement | Diseña un acortador de URLs que soporte alto tráfico de lectura. |
| created_at | 2026-10-22 10:20 |

**`item_system_design`**

| Columna | Valor |
|---|---|
| item_version_id | v5 |
| scenario | Servicio público con 100 millones de URLs nuevas al mes y una relación lectura:escritura de 100:1. |
| functional_requirements | {Crear una URL corta, Redirigir a la URL original, Expiración opcional} |
| non_functional_requirements | {Latencia de redirección menor a 100 ms, Disponibilidad de 99.9%} |
| constraints | {Las URLs cortas tienen como máximo 8 caracteres} |
| reference_answer | API de creación y de redirección; generación de claves (contador con base62 o hash); base de datos clave-valor; caché para lecturas; réplicas de lectura; justificación de trade-offs. |

**`rubric_criteria`**

| id | item_version_id | name | weight | position |
|---|---|---|---|---|
| c5 | v5 | Cumplimiento de requisitos funcionales y no funcionales | 25 | 1 |
| c6 | v5 | Justificación de decisiones y trade-offs | 25 | 2 |
| c7 | v5 | Diseño de componentes y datos | 25 | 3 |
| c8 | v5 | Escalabilidad | 25 | 4 |

**`rubric_levels`**

| criterion_id | score | descriptor |
|---|---|---|
| c5 | 0 | No identifica los requisitos del problema. |
| c5 | 1 | Cubre algunos requisitos funcionales y omite los no funcionales. |
| c5 | 2 | Cubre los requisitos funcionales y los no funcionales principales. |
| c5 | 3 | Cubre todos los requisitos funcionales y no funcionales y deriva decisiones de diseño de ellos. |
| c6 | 0 | No justifica sus decisiones. |
| c6 | 1 | Justifica algunas decisiones sin considerar alternativas. |
| c6 | 2 | Justifica sus decisiones principales señalando sus costos. |
| c6 | 3 | Justifica todas sus decisiones y compara alternativas con sus trade-offs. |
| c7 | 0 | No propone componentes ni modelo de datos. |
| c7 | 1 | Propone componentes sin definir la API ni el modelo de datos. |
| c7 | 2 | Define API, modelo de datos y generación de claves. |
| c7 | 3 | Define API, modelo de datos y generación de claves, y evita colisiones. |
| c8 | 0 | No aborda la escalabilidad. |
| c8 | 1 | Menciona caché o réplicas sin justificar. |
| c8 | 2 | Aplica caché y replicación con justificación. |
| c8 | 3 | Aplica caché, replicación y particionado ante el crecimiento de la carga. |

## 9. `debugging` — Depuración

**Qué es:** el postulante recibe código con un fallo conocido y debe encontrar la causa y corregirla.
**Corrección:** recomendación con LLM-as-judge basada en la rúbrica, con revisión manual posible. Rúbrica obligatoria.

### Tabla `item_debugging` (una fila por versión)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `item_version_id` | uuid | PK, FK → `item_versions.id` | Versión del ítem a la que pertenece |
| `language` | varchar | NN | Lenguaje del código (texto libre) |
| `code` | text | NN | Código con el fallo |
| `symptom_input` | text | | Entrada que provoca el fallo |
| `symptom_expected` | text | NN | Resultado esperado |
| `symptom_observed` | text | NN | Resultado observado |
| `reference_answer` | text | NN | Corrección de referencia |

### Tabla `item_findings` (una fila por causa esperada)

| Columna | Tipo | Clave | Descripción |
|---|---|---|---|
| `id` | uuid | PK | Identificador del hallazgo |
| `item_version_id` | uuid | FK → `item_versions.id`, NN | Versión del ítem a la que pertenece |
| `line` | int | | Línea del código donde está la causa |
| `description` | text | NN | Causa esperada |

Además usa `rubric_criteria` y `rubric_levels` (sección 3).

### Reglas de negocio que la base de datos no cubre

1. Debe tener al menos un hallazgo (`item_findings`), con la causa esperada.
2. `symptom_observed` es distinto de `symptom_expected`.
3. Si un hallazgo indica `line`, esa línea existe en `code`.
4. `language` es texto libre, sin lista cerrada, con la misma comprobación de la IA que en `coding`.
5. Debe tener rúbrica, con al menos un criterio (sección 3.3).

### Ejemplo completo

**`items`**

| id | status | skill_id | created_by | available_to_experts | created_at |
|---|---|---|---|---|---|
| i6 | active | PROG | u1 | true | 2026-10-22 10:25 |

**`item_versions`** (fila `v6`)

| Columna | Valor |
|---|---|
| id | v6 |
| item_id | i6 |
| type | debugging |
| version | 1 |
| origin | generated |
| generation_request_id | g6 |
| level | 3 |
| estimated_minutes | 15 |
| evaluation_goal | Localizar un error de límite y proponer la corrección mínima. |
| statement | La función debería devolver el promedio de la lista, pero falla. Encuentra la causa y corrígela. |
| created_at | 2026-10-22 10:25 |

**`item_debugging`**

| Columna | Valor |
|---|---|
| item_version_id | v6 |
| language | python |
| code | def average(nums):<br>&nbsp;&nbsp;&nbsp;&nbsp;total = 0<br>&nbsp;&nbsp;&nbsp;&nbsp;for i in range(1, len(nums)):<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;total += nums[i]<br>&nbsp;&nbsp;&nbsp;&nbsp;return total / len(nums) |
| symptom_input | [10, 20, 30] |
| symptom_expected | 20.0 |
| symptom_observed | 16.67 |
| reference_answer | Cambiar range(1, len(nums)) por range(len(nums)) y validar el caso de lista vacía. |

**`item_findings`**

| id | item_version_id | line | description |
|---|---|---|---|
| f1 | v6 | 3 | El rango inicia en 1 y omite el primer elemento. |

**`rubric_criteria`**

| id | item_version_id | name | weight | position |
|---|---|---|---|---|
| c9 | v6 | Identificación de la causa raíz | 25 | 1 |
| c10 | v6 | Corrección propuesta | 25 | 2 |
| c11 | v6 | Casos borde | 25 | 3 |
| c12 | v6 | Prevención de regresiones | 25 | 4 |

**`rubric_levels`**

| criterion_id | score | descriptor |
|---|---|---|
| c9 | 0 | No identifica la causa del fallo. |
| c9 | 1 | Señala la zona del error sin la causa exacta. |
| c9 | 2 | Identifica la causa exacta. |
| c9 | 3 | Identifica la causa exacta y explica por qué produce el síntoma. |
| c10 | 0 | No propone corrección o es incorrecta. |
| c10 | 1 | La corrección resuelve el síntoma pero introduce otros errores. |
| c10 | 2 | La corrección es correcta. |
| c10 | 3 | La corrección es correcta, mínima y no rompe otros casos. |
| c11 | 0 | No considera casos borde. |
| c11 | 1 | Menciona casos borde sin tratarlos. |
| c11 | 2 | Trata la lista vacía. |
| c11 | 3 | Trata la lista vacía y otros casos borde relevantes. |
| c12 | 0 | No propone cómo evitar que el error vuelva. |
| c12 | 1 | Menciona probar el caso del síntoma. |
| c12 | 2 | Propone una prueba que cubre el caso del síntoma. |
| c12 | 3 | Propone pruebas que cubren el síntoma y los casos borde. |
