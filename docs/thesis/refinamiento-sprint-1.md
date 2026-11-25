# Refinamiento del Sprint 1: retroalimentación

| Campo | Valor |
|---|---|
| Proyecto | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Fuente | Audios del 30-10-2026 y 06-11-2026 (transcripciones diarizadas), contrastados con `thesis/user-stories.md` y `thesis/requirements-elicitation.md` |
| Estado | Sprint cerrado (16/10 al 30/10/2026); estos cambios son un refinamiento sobre lo entregado, implementado el 25/11/2026 salvo lo diferido (ver «Estado de la implementación») |

Cambios sobre lo ya construido en el Sprint 1 (login, catálogo SFIA y banco de ítems; HU-01 a HU-10, HU-25 y HU-27 a HU-31), a partir de la revisión del prototipo del 30-10. 31 especificaciones de los audios, más 5 decisiones del autor al implementar (HU-04-7, HU-06-4, HU-06-5, HU-08-2 y HU-38). Donde dice **Implementado** se describe lo que se construyó y, si difiere del audio, prevalece (ver `user-stories.md` v0.3).

## Cómo leer este documento

- Las historias que **ya existen** en el Backlog no se repiten. Los refinamientos llevan el código de la existente más un sufijo (`HU-05-2`) y van debajo de ella. Las nuevas tienen códigos provisorios desde `HU-32`.
- **Actores:** docente/reclutador, validador y alumno/postulante, como en el Backlog.
- **Explicitud:** **Alta** es lo que se dijo directamente y se acordó. **Media** es lo que se discutió y aceptó, pero el actor o propósito los inferí. **Baja** es una idea sin acuerdo.
- **Origen** es el código en `historias_de_usuario_audios.md` (`A-xx` es el audio del 30-10, `B-xx` el del 06-11). El **timestamp** es aproximado.

---

Cambios sobre lo ya construido en el Sprint 1 (login, catálogo SFIA y banco de ítems; HU-01 a HU-10, HU-25 y HU-27 a HU-31). Salen de la revisión del prototipo del 30-10 (audio A). En el audio dijeron que parte de esto se podía hacer "como retroalimentación de este sprint".

### HU-04 Generar borradores con IA

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-04-2 | Como docente/reclutador quiero que las alternativas correctas generadas queden balanceadas entre A, B, C y D, para que el banco no tenga todas en la misma opción. | Alta | Se acordó balancear sobre el banco completo, no por skill ni por pedido. **Implementado:** el servidor cuenta las correctas del banco en A, B, C y D, sortea la posición de cada ítem nuevo (más probabilidad para las menos usadas) y el prompt la exige; si la IA no la respeta, se reintenta. Al regenerar se conserva. Una opción que dependa de otras solo puede ir en la última posición (limitación). | A-04 | 00:21:54 a 00:28:30 |
| HU-04-3 | Como docente/reclutador quiero que las preguntas de alternativa única se generen con 4 opciones por defecto y una sola correcta, para tener un formato estándar. | Alta | **Implementado:** el prompt pide exactamente 4 opciones y una sola correcta; el sistema sigue aceptando desde 2 (por ejemplo, al editar). | A-05 | 00:38:42, 00:39:34 |
| HU-04-4 | Como docente/reclutador quiero que en los ítems abiertos la IA genere primero la rúbrica y luego la respuesta de referencia a partir de ella (dos pasos), para obtener respuestas de referencia coherentes con la rúbrica. | Media | **Implementado** en los tres tipos abiertos: una primera llamada genera los ítems con su rúbrica y una segunda llamada por pedido (no por ítem) genera la respuesta de referencia de todos a partir de su rúbrica. | A-07 | 00:43:27 a 00:45:20 |
| HU-04-5 | Como docente/reclutador quiero que las rúbricas generadas tengan 4 niveles y 4 criterios, para que sean utilizables. | Alta | El audio pedía al menos 3 criterios; el autor fijó 4. **Implementado:** lo que genera la IA tiene 4 criterios de peso 25 y 4 niveles (puntajes 0 a 3); quien edita puede agregar más (mínimo 4, con los fijos y pesos que suman 100). | A-08 | 00:46:04 a 00:48:28 |
| HU-04-6 | Como docente/reclutador quiero que la rúbrica combine criterios fijos por tipo de ítem y criterios que la IA ajusta al problema, para que haya consistencia entre ítems del mismo tipo. | Media | **Implementado:** 2 criterios fijos por tipo abierto, con sus 4 descriptores estáticos, en `config/criterios-fijos.json` (lo leen el backend y el portal); la IA escribe solo los otros 2. En el editor los fijos están bloqueados. Adaptarlos es HU-36 (diferida). | A-09 | 00:12:52 a 00:14:00 |
| HU-04-7 | Como docente/reclutador quiero que las respuestas correctas de las preguntas de verdadero o falso generadas queden balanceadas entre verdadero y falso, para que el banco no tenga sesgo. | Media | Nueva (decisión del autor al implementar HU-04-2): mismo mecanismo que HU-04-2, con dos opciones. | Decisión del autor | — |

### HU-05 Puntuar ítems generados por IA

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-05-2 | Como validador quiero puntuar los ítems de 1 a 5 estrellas enteras, para tener una escala simple. | Alta | **Cambia el criterio de HU-05** (0.0 a 5.0 con un decimal). Se decidió sin decimales ("para qué 3.5 y 3.7"). Afecta también HU-25: el promedio se mostraría en estrellas. Isaias calificó una pregunta en la mañana, así que es la vista del validador. | A-21 | 01:17:23 a 01:18:39 |

### HU-06 Crear ítems de una skill específica

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-06-2 | Como docente/reclutador quiero una explicación o un ejemplo al pasar el cursor sobre cada tipo de ítem, sobre «Cantidad» y sobre «Tiempo (min)» del formulario de generación, para entender qué configuro. | Alta | Mejora la pantalla de HU-06. **Implementado** como texto subrayado con puntos que muestra el tooltip al pasar el cursor; «Cantidad» y «Tiempo (min)» son títulos de columna que aparecen una sola vez y cada tipo lleva su icono. Primero se probó un ícono «i»; se prefirió el hover. | A-03 | 00:20:27, 00:21:03 |
| HU-06-3 | Como docente/reclutador quiero que el sistema me recomiende qué tipos de ítem son pertinentes para cada skill y nivel (por ejemplo en negrita), y poder generar otros bajo mi propio riesgo, para no pedir preguntas sin sentido. | Alta | Surge de un coding challenge de debugging poco razonable generado para una skill de diseño. **Diferida: queda como limitación** (ver `sprint-1.md`): el sistema no recomienda ni restringe los tipos por skill y nivel. | A-06 | 01:11:04 |
| HU-06-4 | Como docente/reclutador quiero añadir al formulario las skills de uno o varios roles SFIA, viendo los roles por familia y las skills core y related por separado y marcando las que quiero, para armar lo que evalúo sin añadir las skills una a una. | Alta | Nueva (decisión del autor; relacionada con HU-11-2 y HU-11-3 del Sprint 2). **Implementado:** ventana con las 21 familias y sus roles; al elegir un rol, sus skills core y related como tarjetas, ninguna marcada de antemano; se añaden solo las marcadas, sin reemplazar lo que hay y sin guardar el rol de origen; las ya añadidas aparecen rellenas, con aviso y bloqueadas. Guardar el rol es HU-38 (diferida). | Decisión del autor | — |
| HU-06-5 | Como docente/reclutador quiero que el formulario de generación se lea con claridad (skill y nivel juntos, resumen con colores e iconos y un motivo cuando no puedo avanzar), para configurar sin dudas. | Media | Nueva (decisión del autor a partir de las pruebas del portal). **Implementado:** skill con solo su nombre y el nivel junto a ella; «Contexto para la skill»; «Tipos de ítem» y «Tiempo (min)»; resumen minimizado y Paso 2 con la skill en su color y los tipos con icono, cantidad y minutos; «Siguiente» explica por qué no se puede pulsar; todas las pantallas de Generar ítems a ancho completo. | Decisión del autor | — |

### HU-08 Ver los atributos de un ítem

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-08-2 | Como docente/reclutador y como validador quiero ver un ítem del banco con la misma vista que un borrador, separando lo que verá quien rinda de lo que solo ve el docente/reclutador, para saber cómo se presentará la pregunta. | Media | Nueva (decisión del autor; extiende HU-27-6). **Implementado:** el banco y el portal del experto usan el mismo componente que la revisión: «Lo que verá quien rinda» (con el título de cada dato) y «Solo para el docente/reclutador» (qué evalúa, respuesta correcta o de referencia y rúbrica como matriz). | Decisión del autor | — |

### HU-27 Revisar los borradores antes de publicarlos

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-27-2 | Como docente/reclutador quiero ver la pregunta completa de un borrador (en un modal o panel) sin entrar a "editar", y tener editar, regenerar y descartar arriba como iconos, para revisar con comodidad. | Alta | Se prefirió el modal o panel a las tarjetas desplegables. **Implementado** como panel (lista a la izquierda, borrador completo a la derecha) con editar, regenerar y descartar como iconos; al editar se conserva el orden de la vista; el comentario para la IA al regenerar aparece debajo, a todo el ancho del panel. | A-16 | 00:35:13, 00:50:43 a 00:51:30 |
| HU-27-3 | Como docente/reclutador quiero ver siempre en qué borrador voy y cuántos son (indicador fijo con número), para no perderme al revisar varios. | Alta | Propuesta: un panel con encabezado fijo. **Implementado:** «Borrador N de M» siempre visible, con flechas para pasar al anterior o siguiente. | A-17 | 00:49:41 a 00:50:39 |
| HU-27-4 | Como docente/reclutador quiero ver la rúbrica de un borrador como matriz (criterios en filas, niveles en columnas), para leerla como una rúbrica convencional. | Alta | HU-27 no menciona la rúbrica entre los datos mostrados. **Implementado:** una fila por criterio y una columna por nivel (puntajes 0 a 3), con celdas compactas y desplazamiento horizontal si hace falta. | A-18 | 00:48:33 a 00:49:30 |
| HU-27-6 | Como docente/reclutador quiero distinguir visualmente lo que verá el alumno/postulante de lo que veo yo (marco o color), para saber cómo se presentará la pregunta al rendirla. | Alta | Hoy "se intuye más que se sabe". **Implementado:** «Lo que verá quien rinda» (marco azul, con el título de cada dato) y «Solo para el docente/reclutador» (marco punteado); el banco y el portal del experto usan la misma vista (HU-08-2). | A-19 | 01:03:26 a 01:04:45 |

### HU-30 Descartar y restaurar borradores

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-30-2 | Como docente/reclutador quiero que, al volver atrás desde la revisión de borradores, se descarten los borradores generados pero se conserve mi selección (skills, nivel, tipos), para generar otra tanda sin empezar de cero. | Alta | Hoy existe el botón descartar pero no volver. **Implementado:** «Volver» pide confirmación, descarta los borradores generados y regresa al Paso 2 (Resumen) con los recuadros intactos. | A-15 | 00:30:00 a 00:31:13 |

### Historias nuevas (códigos provisorios)

| ID | Historia | Explicitud | Qué cambia o agrega | Origen | Timestamp |
|---|---|---|---|---|---|
| HU-37 | Como docente/reclutador quiero que el banco use iconos y colores en vez de texto (tipo de ítem, nivel) y aproveche mejor el espacio, para escanearlo rápido. | Media | Nueva (no existe en el Backlog). **Implementado:** tipo con icono de color (12 `.svg` propios) y nivel como celda con el color de la categoría de la skill, en el banco y en la revisión; el Paso 1 usa los mismos iconos. | A-22 | 01:16:46 a 01:17:23 |
| HU-36 | Como reclutador quiero quitar o agregar criterios en la rúbrica base de un tipo de pregunta, para adaptarla a lo que valoro. Se dejó para después de este año. | Media | Nueva (no existe en el Backlog) | A-10 | 00:14:01 a 00:15:06 |
| HU-38 | Como docente/reclutador quiero guardar las skills que elegí como un rol personalizado, para reutilizarlo después sin volver a elegirlas. | Alta | Nueva (decisión del autor al implementar HU-06-4). Diferida: requiere almacenamiento nuevo (a quién pertenece, si se comparte, si se edita o se borra); queda como limitación. | Decisión del autor | — |

HU-36 está diferida: en el audio se dijo que se aborda después de "esta vuelta", es decir después de este año. HU-38 también está diferida (ver `sprint-1.md`, limitaciones).

---

## Estado de la implementación

| Historia | Estado |
|---|---|
| HU-04-2 a HU-04-7 | Implementadas (HU-04-5 con 4 criterios en lugar de 3, por decisión del autor) |
| HU-05-2 | Implementada (migración `002_puntuacion_estrellas.sql` y estrellas en el portal) |
| HU-06-2, HU-06-4, HU-06-5 | Implementadas |
| HU-06-3 | **Diferida**: limitación (no se recomiendan tipos por skill y nivel) |
| HU-08-2 | Implementada |
| HU-27-2, HU-27-3, HU-27-4, HU-27-6 | Implementadas (HU-27-5 es del Sprint 2) |
| HU-30-2 | Implementada |
| HU-37 | Implementada |
| HU-36, HU-38 | **Diferidas**: limitaciones (adaptar la rúbrica base; guardar un rol propio) |

## Ya existen en el Backlog (no se repiten)

| Origen | Lo que dijeron | Historia existente |
|---|---|---|
| A-01 | Generar preguntas indicando skill, nivel, tipo, cantidad y duración | HU-04, HU-06 |
| A-02 | Contexto o instrucciones extra para la IA (por ejemplo, "sistemas universitarios") | HU-06, criterio 4 (contexto opcional por skill) |
| A-14 | Editar cualquier campo de un borrador antes de publicar | HU-28 |
| A-20 | Ver y filtrar el banco por skill, nivel y rol | HU-03, HU-07, HU-08, HU-09, HU-25 |

## Puntos del Backlog que esto contradice

| Backlog | Audios |
|---|---|
| HU-05 (RF-05): puntuación de 0.0 a 5.0 con un decimal | HU-05-2: 1 a 5 estrellas enteras |

Afecta también HU-25, cuyo promedio se mostraría en estrellas.

## Advertencias
- **Calidad de la transcripción:** en el audio A hay tramos ilegibles (01:07 a 01:09 y 00:51 a 00:54). Las historias de esos tramos pueden estar incompletas.
- **Atribución de hablantes:** la diarización asigna un solo hablante por línea, así que dentro de un mismo turno puede haber frases de otra persona.
- **Actor ambiguo:** en los audios "evaluador", "reclutador" y "docente" se usan casi como sinónimos. Los unifiqué en docente/reclutador, como en el Backlog.
