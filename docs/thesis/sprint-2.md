# Sprint 2: constructor de evaluaciones

| Campo | Valor |
|---|---|
| Proyecto | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Estado | **En desarrollo** |
| Objetivo | Armar una evaluación con ítems del banco, publicarla y compartirla por link. Módulo principal: Constructor de Evaluaciones (Portal de Gestión). |
| Fuentes | `thesis/user-stories.md`, plan del Sprint 2 (`sprint2/presentacion`) y audios del 30-10-2026 y 06-11-2026 |

Este documento reúne todo el alcance del Sprint 2: las historias del Backlog que ya estaban en el plan, con el texto completo de `thesis/user-stories.md`, y las especificaciones nuevas que salieron de los audios.

## Cómo leer este documento

- Cada historia del Backlog va con su texto original. Debajo, en una tabla, van las **especificaciones de los audios**, con el código de la historia más un sufijo (`HU-11-2`). Pueden precisar, agregar o contradecir criterios de la historia base, y la columna "Qué cambia" lo dice.
- Las **historias nuevas** que no existían tienen códigos provisorios desde `HU-32`.
- **Prioridad** es la del plan del Sprint 2: núcleo (sin ellas el sprint no cumple su objetivo), probable (dependen del versionado de ítems) y por validar.
- **Actores:** docente/reclutador, validador y alumno/postulante, como en el Backlog.
- **Explicitud:** **Alta** es lo que se dijo directamente y se acordó. **Media** es lo que se discutió y aceptó, pero el actor o propósito los inferí.
- **Origen** es el código en `historias_de_usuario_audios.md` (`A-xx` es el audio del 30-10, `B-xx` el del 06-11). El timestamp es aproximado.

## 1. Alcance del Sprint 2

| HU | Título | Prioridad | Especificaciones de los audios |
|---|---|---|---|
| HU-11 | Armar una evaluación | Núcleo | HU-11-2, HU-11-3, HU-11-4 |
| HU-12 | Guardar como plantilla o publicar | Núcleo | HU-12-2, HU-12-3 |
| HU-38 | Guardar un rol propio con las skills elegidas | Núcleo (con HU-11-3 y HU-12) | ninguna |
| HU-16 | Compartir una evaluación por link | Núcleo | HU-16-2, HU-16-3, HU-16-4 |
| HU-13 | Modificar un ítem manualmente | Probable | ninguna |
| HU-14 | Regenerar un ítem con un nuevo contexto | Probable | HU-14-2 |
| HU-26 | Versionar un ítem al modificarlo o regenerarlo | Probable | ninguna |
| HU-15 | Conservar mis ítems modificados (fusionada en HU-26) | Probable | ninguna |
| Nuevas | Ejecuciones de una evaluación (HU-32, HU-33) y rúbrica visible al armar (HU-27-5) | Propuesta | HU-32, HU-33, HU-27-5 |

Rendir la evaluación (HU-17 a HU-19), la corrección (HU-20 a HU-23) y los reportes (HU-24) quedan fuera del Sprint 2.

HU-38 (diferida en el Sprint 1) se incluye en este sprint junto con HU-11-3 y HU-12.

## 2. Historias del Backlog y sus especificaciones

### HU-11 Armar una evaluación

**Requisito:** RF-11

**Como** docente/reclutador, **quiero** armar una evaluación con plantillas de perfiles SFIA y un editor visual drag-and-drop, **para** componerla sin trabajo manual.

**Criterios de aceptación:**
- Puedo partir de una plantilla de perfil SFIA.
- Puedo agregar y ordenar ítems con un editor visual drag-and-drop.
- El banco del constructor solo ofrece los ítems que cumplen las reglas (las skills de la evaluación y los niveles de cada una) y se puede ordenar y paginar. Para usar otra skill u otro nivel se cambian las reglas en el paso 1; ya no hay confirmaciones al agregar. *(Decisión del autor, 26/11/2026)*

**Prioridad en el plan del Sprint 2:** Núcleo.

**Especificaciones de los audios**

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-11-2 | Como docente/reclutador quiero partir de un rol SFIA, ver sus skills con los niveles en que SFIA las define y restringir, para cada skill, los niveles que se evaluarán (por ejemplo, PROG de nivel 3 a 4), para que el banco se filtre según lo que quiero evaluar. | Alta | HU-11 solo dice "partir de una plantilla de perfil SFIA". Los niveles se definen por skill, no por rol. Se dijo que esto limita mucho el banco. **Decisión del autor (25/11/2026):** el rango es de cada skill y no de toda la evaluación; por defecto es el que SFIA define para esa skill. Un rol solo define qué skills se incluyen: SFIA no especifica en qué nivel se aplica cada skill dentro de un rol, así que los niveles nunca son del rol. | A-23 | 01:19:51 a 01:22:52 |
| HU-11-3 | Como docente/reclutador quiero ver qué skills de un rol son core y cuáles related al añadirlas desde él (solo como ayuda para elegir) y agregar skills propias que no están en él, para armar mi versión del rol. Si agrego o quito skills, el rol pasa a ser un rol personalizado que puedo guardar. | Alta | Se acordó mostrar core y related por separado. Saber cuál es related sirve también para análisis posterior. **Decisión del autor (25/11/2026):** en la evaluación ya no se distingue core y related (solo se ve al elegir desde el rol); guardar el rol personalizado es opcional (HU-38). | A-24 | 01:24:27 a 01:29:32 |
| HU-11-4 | Como docente/reclutador quiero configurar la duración total de la prueba, con la suma de los minutos de sus ítems como valor recomendado y libertad para subirla o bajarla (con un aviso si baja de esa suma), para ajustarla a mi caso. | Media | Decisión del autor (25/11/2026): reemplaza «no bajar de la definida por el sistema» por un aviso al bajar de la suma. Se relaciona con la pregunta al cliente sobre el tiempo máximo global. | B-07 | 00:08:36 a 00:09:02 |


### HU-12 Guardar como plantilla o publicar

**Requisito:** RF-12

**Como** docente/reclutador, **quiero** guardar una evaluación como plantilla o publicarla, **para** reutilizarla o ponerla a disposición de quienes la rendirán.

**Criterios de aceptación:**
- Puedo guardar la evaluación como plantilla.
- Puedo publicar la evaluación.

**Prioridad en el plan del Sprint 2:** Núcleo.

**Especificaciones de los audios**

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-12-2 | Como docente/reclutador quiero marcar mis plantillas como públicas o privadas, para que otros docentes las reutilicen. | Alta | **Contradice el supuesto S-6 del Sprint 2** ("la plantilla es privada"). Se comparó con el check "publicar para todos" de los ítems. **Una plantilla pública solo puede tener ítems públicos:** al hacerla pública se confirma hacer públicos los ítems propios privados; los ítems privados de otro docente lo impiden. | A-29 | 01:40:42 a 01:42:08 |
| HU-12-3 | Como docente/reclutador quiero que una evaluación pase por los estados borrador, lista/publicada y descartada, y poder descartarla para que deje de aparecer entre las disponibles, para ordenar mi trabajo. | Alta | Se acordó que una publicada no se edita, y que si cambio algo es otra evaluación. Los estados son de la evaluación; la ejecución es otra cosa (ver HU-32). | A-30, A-32 | 01:34:07 a 01:35:28, 01:39:37, 01:40:14 |


### HU-38 Guardar un rol propio con las skills elegidas

**Requisito:** sin RF (código provisorio)

**Como** docente/reclutador, **quiero** guardar las skills que elegí como un rol personalizado, **para** reutilizarlo después sin volver a elegirlas.

**Prioridad en el plan del Sprint 2:** Núcleo, junto con HU-11-3 y HU-12. Salió diferida del Sprint 1 porque necesitaba almacenamiento nuevo (a quién pertenece el rol, si se comparte, si se edita o se borra). Ese almacenamiento es el mismo de la plantilla de HU-12-2 (pública o privada), por eso se resuelve en este sprint.


### HU-16 Compartir una evaluación por link

**Requisito:** RF-16

**Como** docente/reclutador, **quiero** obtener un link compartible al publicar una evaluación, **para** enviarlo a quienes deben rendirla.

**Criterios de aceptación:**
- Al publicar, se genera un link con un `share_token`.
- Puedo copiar y compartir el link.

**Prioridad en el plan del Sprint 2:** Núcleo.

**Especificaciones de los audios**

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-16-2 | Como docente/reclutador quiero compartir la evaluación solo con una lista de correos que yo defino, para que respondan solo personas registradas. | Alta | Responde el pendiente **CP-05** (quién puede abrir un link). Se acordó la lista de correos primero, y el link abierto después. | A-27 | 01:32:04 a 01:32:56 |
| HU-16-3 | Como docente/reclutador quiero que cada persona invitada reciba un token único de acceso, con la misma vigencia que la ejecución, para que solo ella pueda contestar. | Alta | Se prefirió al login con Google por ser más simple y con menos limitaciones. Afecta HU-17 (el alumno/postulante entra con el token). | B-04 | 00:01:57 a 00:03:21 |
| HU-16-4 | Como docente/reclutador quiero que cada ejecución tenga siempre fecha de inicio y de cierre, y poder reprogramarlas, para controlar cuándo se puede rendir. | Alta | **Contradice el supuesto S-4 del Sprint 2** ("el link no caduca"). Responde la pregunta al cliente sobre apertura y cierre automáticos. | B-03 | 00:01:34 a 00:01:57 |


### HU-13 Modificar un ítem manualmente

**Requisito:** RF-13

**Como** docente/reclutador, **quiero** modificar manualmente un ítem generado, **para** ajustarlo según estime conveniente.

**Criterios de aceptación:**
- Puedo editar un ítem desde el banco de ítems: su enunciado, el contenido propio de su tipo, la rúbrica y el tiempo estimado. El tipo, la skill y el nivel no cambian.
- Lo que guardo cumple las mismas reglas que lo generado (por ejemplo, los pesos de la rúbrica suman 100).
- Mis cambios se guardan como una versión nueva del ítem (HU-26). Si el ítem es de otro docente, se guardan como una copia mía y el original no cambia (HU-15).
- Al guardar decido de nuevo si el ítem queda disponible para expertos.

**Prioridad en el plan del Sprint 2:** Probable.


### HU-14 Regenerar un ítem con un nuevo contexto

**Requisito:** RF-14

**Como** docente/reclutador, **quiero** regenerar un ítem indicando un nuevo contexto, **para** obtener una variante más ajustada a mi caso.

**Criterios de aceptación:**
- Puedo indicar un nuevo contexto para un ítem (es obligatorio).
- La plataforma genera una vista previa del ítem con ese contexto; no se guarda nada hasta que confirmo.
- Al confirmar se guarda una versión nueva (HU-26) y el contexto indicado queda guardado junto con ella.
- La nueva versión mantiene el tipo, la skill, el nivel y el tiempo de la anterior, y en alternativa única y verdadero o falso, también la respuesta correcta (HU-14-2; reemplaza el criterio original que permitía cambiar el tipo).
- Si el ítem es de otro docente, se guarda como una copia mía (HU-15).

**Prioridad en el plan del Sprint 2:** Probable.

**Especificaciones de los audios**

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-14-2 | Como docente/reclutador quiero regenerar un ítem cambiando solo su contexto (empresa o lenguaje) y que el tipo de ítem se mantenga, para hacer las mínimas modificaciones. | Alta | **Contradice el criterio 4 de HU-14 y RF-14** ("puede ser de un tipo distinto"). En el audio se descartó cambiar el tipo. Guardar la versión nueva en el banco propio ya lo cubre HU-26 (que incluye HU-15). | A-26 | 01:30:29 a 01:31:54 |


### HU-26 Versionar un ítem al modificarlo o regenerarlo

**Requisito:** RF-26

**Como** docente/reclutador, **quiero** que al modificar o regenerar un ítem se cree una nueva versión que quede en mi banco, **para** conservar la versión anterior junto con sus puntuaciones y reutilizar mi versión en futuras evaluaciones.

**Criterios de aceptación:**
- Al regenerar un ítem con un nuevo contexto, se crea una nueva versión.
- Al modificar un ítem manualmente, se crea una nueva versión.
- La versión anterior se conserva.
- Las puntuaciones quedan asociadas solo a la versión anterior.
- La nueva versión parte sin puntuar.
- Cada versión registra su origen: generada, regenerada o modificada manualmente.
- Al guardar elijo si el ítem queda disponible para expertos (una copia parte privada). La disponibilidad es del ítem y vale para todas sus versiones. *(de HU-15)*
- Si el ítem es de otro docente, se crea una copia mía (ítem nuevo, versión 1, con referencia al original) y el original no cambia. *(de HU-15)*
- Reconozco mis ítems privados en el banco por la marca «Privado» (una copia propia parte privada). El filtro «Solo mis ítems» se quitó de la interfaz por decisión del autor (26/11/2026): privado ya indica que es mío; la API conserva `mine`. *(de HU-15)*
- Puedo ver el historial de versiones de un ítem, con su origen, fecha y puntuación.

**Prioridad en el plan del Sprint 2:** Probable (incluye HU-15).


### HU-15 Conservar mis ítems modificados *(fusionada en HU-26)*

**Requisito:** RF-15 (fusionado en RF-26; se conserva el número)

HU-15 se fusionó en HU-26: guardar el ítem modificado en el banco personal es consecuencia de versionarlo, y la privacidad de la versión nueva reutiliza la disponibilidad de HU-31. Sus dos criterios pasaron a HU-26.

## 3. Historias nuevas

Códigos provisorios. No existen en el Backlog.

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-32 | Como docente/reclutador quiero crear varias ejecuciones de una misma evaluación publicada (grupos o fechas distintas), independientes y en paralelo, ver cuántas personas han respondido en cada una y compararlas, para reutilizar la evaluación sin duplicarla. | Alta | Nueva (no existe en el Backlog) | A-31, B-01 | 01:34:42 a 01:39:15; 00:00:00 a 00:01:19 |
| HU-33 | Como docente/reclutador quiero ver si una evaluación publicada tiene ejecuciones activas, sin que eso cambie su estado, para saber cuándo está en uso. Una ejecución activa impide modificar la evaluación. | Media | Nueva (no existe en el Backlog) | B-02 | 00:00:56 a 00:01:34 |

## 4. Especificación de otra historia aplicada al armado

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-27-5 | Como docente/reclutador quiero ver la rúbrica con la que se medirá cada ítem mientras armo la evaluación, para saber qué se evaluará. | Alta | Se pidió transparencia, aunque no se defina todavía si se podrá modificar. | A-11 | 00:15:06 a 00:15:55 |

HU-27-5 conserva el código de la historia de revisión de borradores (Sprint 1), pero el audio la pide al armar la evaluación, por eso va aquí.

## 5. Confirmado por los audios (sin cambios)

| Origen | Lo que dijeron | Historia existente |
|---|---|---|
| A-25 | Guardar el perfil o selección armada para reutilizarla | HU-12 (guardar como plantilla) |
| A-28 | Guardar una evaluación como plantilla, reutilizarla y modificarla | HU-12 |
| B-12 | Regenerar ítems según el contexto empresarial | HU-14 |

## 6. Puntos del Backlog y de los supuestos del Sprint 2 que esto contradice

| Backlog | Audios |
|---|---|
| HU-14, criterio 4 (RF-14): la nueva versión puede ser de otro tipo | HU-14-2: el tipo se mantiene |
| Supuesto S-4 (Sprint 2): el link no caduca | HU-16-4: fecha de inicio y cierre obligatorias |
| Supuesto S-6 (Sprint 2): la plantilla es privada | HU-12-2: plantillas públicas o privadas |
| CP-05 (pendiente): quién abre un link compartido | HU-16-2 y HU-16-3: lista de correos y token único |

## 7. Decisiones momentáneas y limitaciones por conversar

- **Ítem desactivado o no público dentro de una plantilla pública.** Decisión momentánea: mientras algún ítem de la plantilla esté inactivo o deje de ser público (porque su autor lo vuelve privado), la plantilla deja de estar disponible: no aparece para otros docentes ni se puede usar; al dueño se le muestra como «no disponible» con los ítems que la bloquean. Si el ítem se reactiva o vuelve a ser público, la plantilla vuelve a estar disponible. Las evaluaciones ya creadas desde esa plantilla no cambian. **Para conversar:** si se avisa al dueño, si debe poder reemplazar o quitar el ítem desde la plantilla, y qué pasa con quien ya la estaba usando.
- **La disponibilidad de una plantilla se calcula en cada consulta** (no se guarda). Limitación y punto de mejora: con muchas plantillas o ítems cada listado repite el cálculo y no queda registro de cuándo ni por qué dejó de estar disponible.
- **`share_token` sin usar.** `evaluation.evaluations.share_token` existe en el esquema, pero publicar no lo genera: HU-16 pide un link con `share_token` al publicar, y HU-16-2 y HU-16-3 (lista de correos y token único por invitado) hacen dudoso su uso. Decisión momentánea: no se genera por ahora. Limitación y punto de mejora: decidir en la Fase 4, al diseñar los links y las ejecuciones, si el token de cada invitado basta (y la columna se elimina) o si hace falta uno por evaluación.
- **Ítem desactivado o vuelto privado dentro de evaluaciones publicadas.** Decisión: se permite, con un aviso al docente que indica cuántas evaluaciones publicadas y plantillas públicas lo usan. Las evaluaciones publicadas no cambian, porque apuntan a versiones fijas que nunca se modifican ni se borran (no existe «eliminar» un ítem y la FK de `design_items` impide borrar una versión en uso). Limitaciones y puntos de mejora: el aviso es informativo y no bloquea; no se notifica a quienes tienen evaluaciones o plantillas con ese ítem, ni se les dice cuáles son (solo cuántas); y como la ficha de una versión sigue las reglas de visibilidad del banco, si un ítem ajeno deja de estar disponible ya no se puede ver su detalle desde la evaluación de otro docente.

## 8. Advertencias
- **Calidad de la transcripción:** en el audio A hay tramos ilegibles (01:07 a 01:09 y 00:51 a 00:54). Las historias de esos tramos pueden estar incompletas.
- **Atribución de hablantes:** la diarización asigna un solo hablante por línea, así que dentro de un mismo turno puede haber frases de otra persona.
- **Actor ambiguo:** en los audios "evaluador", "reclutador" y "docente" se usan casi como sinónimos. Los unifiqué en docente/reclutador, como en el Backlog.
