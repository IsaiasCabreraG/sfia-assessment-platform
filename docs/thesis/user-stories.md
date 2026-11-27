# Historias de Usuario

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Versión   | 0.4                                                                                             |
| Fecha     | 25/11/2026                                                                                      |
| Autor(es) | Isaías Cabrera                                                                                  |
| Estado    | Borrador                                                                                        |

> Cada historia de usuario (HU-NN) desarrolla el requisito funcional del mismo número (RF-NN) de `requirements-elicitation.md`.

> **Versión 0.2:** integra el refinamiento del Sprint 1 (`refinamiento-sprint-1.md`) y el alcance del Sprint 2 (`sprint-2.md`), que salen de los audios del 30-10 y 06-11-2026. Los refinamientos van bajo cada historia con código `HU-NN-n` y su explicitud (**Alta**: dicho y acordado; **Media**: discutido y aceptado, pero actor o propósito inferidos). El origen `A-xx` es el audio del 30-10 y `B-xx` el del 06-11 (detalle y timestamps en `historias_de_usuario_audios.md`). Las historias nuevas llevan códigos provisorios (HU-32 a HU-38) y aún no tienen RF. HU-34 y HU-35 quedan fuera de ambos sprints.

> **Versión 0.3 (25/11/2026):** registra cómo quedó implementado el refinamiento del Sprint 1. En cada refinamiento, la frase **Implementado** describe lo que se construyó y, cuando difiere de los audios, prevalece sobre ellos (por ejemplo, HU-04-5 pasó de «al menos 3 criterios» a «4 criterios» y HU-27-2 se resolvió con un panel en lugar de un modal). Se agregan HU-04-7, HU-06-4, HU-06-5, HU-08-2 y HU-38, que son decisiones del autor al implementar. Quedan diferidas HU-06-3, HU-36 y HU-38; sus limitaciones están en `sprint-1.md`.

**Criterios del v0.1 que cambian**

| Historia | v0.1 | Ahora (v0.2 y v0.3) |
|---|---|---|
| HU-05 (y HU-25, HU-07) | Puntuación de 0.0 a 5.0 con un decimal | Cada puntuación es de 1 a 5 estrellas enteras (HU-05-2); el promedio de varias puede tener decimales; sin puntuar se muestra con una estrella tachada |
| HU-04 (rúbrica) | La rúbrica de los tipos abiertos tiene al menos un criterio y sus pesos suman 100 | Lo que genera la IA tiene 4 criterios de peso 25: 2 fijos por tipo y 2 propios del problema; quien edita puede agregar más (mínimo 4, con los fijos y pesos que suman 100) y no puede modificar los fijos (HU-04-5, HU-04-6) |
| HU-06, criterio 1 | Puedo partir de un rol SFIA | Puedo añadir las skills que yo marque de uno o varios roles; no se guarda el rol de origen (HU-06-4) |
| HU-14, criterio 4 | La nueva versión puede ser de otro tipo | El tipo se mantiene (HU-14-2) |
| HU-28, criterio 3 | Lo editado cumple las mismas reglas que lo generado (por ejemplo, pesos que suman 100) | Además, la rúbrica tiene al menos 4 criterios e incluye los fijos del tipo (HU-04-5, HU-04-6) |
| Supuesto S-4 (Sprint 2) | El link no caduca | Cada ejecución tiene fecha de inicio y cierre (HU-16-4) |
| Supuesto S-6 (Sprint 2) | La plantilla es privada | Plantillas públicas o privadas (HU-12-2) |
| Pendiente CP-05 (Sprint 2) | Quién abre un link compartido | Lista de correos y token único (HU-16-2, HU-16-3) |

**Fuera del Sprint 2:** rendir la evaluación (HU-17 a HU-19), corrección (HU-20 a HU-23) y reportes (HU-24).

> Los refinamientos posteriores de los audios sobre HU-19, HU-21 y HU-24 (HU-19-2, HU-21-2, HU-24-2 a HU-24-4) no se integraron aquí; siguen solo en `historias_de_usuario_audios.md`.

## 1. Autenticación

### HU-01 Iniciar sesión con Google

**Requisito:** RF-01

**Sprint:** Sprint 1

**Como** usuario, **quiero** iniciar sesión con mi cuenta de Google, **para** acceder a la plataforma sin crear otra credencial.

**Criterios de aceptación:**
- Existe la opción de iniciar sesión con Google (OIDC).
- Tras autenticarme con Google, accedo a la plataforma con mi cuenta.
- Mientras uso la plataforma, mi sesión se renueva sola; si paso 7 días sin usarla, debo iniciar sesión de nuevo.
- Al cerrar sesión, mi sesión deja de poder renovarse.

## 2. Catálogo SFIA

### HU-02 Consultar el catálogo SFIA

**Requisito:** RF-02

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** acceder al catálogo SFIA y elegir con él las skills, los niveles y el perfil de rol que quiero evaluar, **para** generar ítems alineados con SFIA.

**Criterios de aceptación:**
- Hay un botón que lleva al sitio oficial de SFIA.
- Al generar ítems puedo elegir una skill del catálogo, su nivel de responsabilidad (1 a 7) y partir de un perfil de rol predefinido que carga las skills del rol.
- Cada skill conserva el nivel mínimo y máximo en que SFIA la define.

## 3. Banco de ítems

**Flujo en los portales**

| Pantalla | Qué hace el usuario | HU |
|---|---|---|
| Acceso (ambos portales) | Inicia sesión con Google | HU-01 |
| Docente › barra superior › "Catálogo SFIA ↗" | Abre el sitio oficial de SFIA | HU-02 |
| Docente › Generar ítems › Paso 1 "Qué evaluar" | Elige rol SFIA, skills (en un menú con buscador), nivel, contexto de cada skill, tipos de ítem, cantidad y tiempo por ítem | HU-02, HU-06, HU-10 |
| Docente › Generar ítems › Paso 2 "Resumen" | Revisa el resumen y pulsa "Generar" | HU-04, HU-06 |
| Docente › Generar ítems › Paso 3 "Revisa los borradores" | Edita, regenera o descarta cada borrador | HU-27 a HU-30 |
| Docente › Generar ítems › pie del Paso 3 | Elige la disponibilidad y pulsa "Publicar N preguntas" | HU-31 |
| Docente › Banco de ítems | Filtra, ve el detalle y activa o desactiva ítems | HU-03, HU-08, HU-09, HU-25 |
| Validador › lista de ítems | Filtra por skill, rol y puntuación | HU-07 |
| Validador › detalle del ítem | Ve los atributos y pone su puntuación | HU-05, HU-08, HU-25 |

### HU-03 Asociar ítems a una skill y un nivel SFIA

**Requisito:** RF-03

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** que cada ítem esté asociado a una skill y a un nivel SFIA, **para** saber qué competencia mide.

**Criterios de aceptación:**
- Todo ítem del banco está asociado a una única skill SFIA y a un nivel de responsabilidad.
- La skill y el nivel de un ítem son visibles al consultarlo.

### HU-04 Generar borradores con IA

**Requisito:** RF-04

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** que la plataforma genere con IA borradores de preguntas, ejercicios y rúbricas, **para** no tener que redactar cada ítem desde cero.

**Criterios de aceptación:**
- La IA genera borradores de preguntas, de ejercicios y de rúbricas.
- Los borradores generados quedan sin puntuar.

**Refinamientos (audios del 30-10 y 06-11, implementados en el refinamiento del Sprint 1):**
- **HU-04-2** Como docente/reclutador quiero que las alternativas correctas generadas queden balanceadas entre A, B, C y D, para que el banco no tenga todas en la misma opción. *(Explicitud: Alta; origen A-04)*
  - *Qué cambia:* Se balancea sobre el banco completo, no por skill ni por pedido. **Implementado:** antes de pedir los ítems, el servidor consulta cuántas correctas hay en A, B, C y D en todo el banco y sortea la posición de cada ítem nuevo, con más probabilidad para las menos usadas; el prompt exige esa posición y, si la IA no la respeta, se reintenta. Al regenerar un borrador se conserva la posición que tenía. Una opción que dependa de otras («todas las anteriores», «A y B») solo puede ir en la última posición (ver las limitaciones en `sprint-1.md`).
- **HU-04-3** Como docente/reclutador quiero que las preguntas de alternativa única se generen con 4 opciones por defecto y una sola correcta, para tener un formato estándar. *(Explicitud: Alta; origen A-05)*
  - *Qué cambia:* **Implementado:** el prompt pide exactamente 4 opciones y una sola correcta. El sistema sigue aceptando desde 2 opciones (por ejemplo, en lo que edita el docente/reclutador).
- **HU-04-4** Como docente/reclutador quiero que en los ítems abiertos la IA genere primero la rúbrica y luego la respuesta de referencia a partir de ella (dos pasos), para obtener respuestas coherentes con la rúbrica. *(Explicitud: Media; origen A-07)*
  - *Qué cambia:* **Implementado** en los tres tipos abiertos (pregunta de desarrollo, system design y debugging): una primera llamada genera los ítems con su rúbrica y una segunda llamada por pedido (no por ítem) genera la respuesta de referencia de todos los ítems a partir de su enunciado y su rúbrica. Cada paso tiene sus propios reintentos.
- **HU-04-5** Como docente/reclutador quiero que las rúbricas generadas tengan 4 niveles y 4 criterios, para que sean utilizables. *(Explicitud: Alta; origen A-08; el número de criterios lo fijó el autor)*
  - *Qué cambia:* El audio pedía al menos 3 criterios. **Implementado:** lo que genera la IA tiene exactamente 4 criterios, todos de peso 25, y 4 niveles (puntajes 0 a 3). Quien revisa o edita un borrador puede agregar más criterios: se exigen al menos 4, que estén los fijos del tipo y que los pesos sumen 100.
- **HU-04-6** Como docente/reclutador quiero que la rúbrica combine criterios fijos por tipo de ítem y criterios que la IA ajusta al problema, para que haya consistencia entre ítems del mismo tipo. *(Explicitud: Media; origen A-09)*
  - *Qué cambia:* **Implementado:** cada tipo abierto tiene 2 criterios fijos, con sus 4 descriptores estáticos, definidos en `config/criterios-fijos.json` (lo leen el backend y el portal). Pregunta de desarrollo: «Precisión conceptual» y «Claridad y estructura»; system design: «Cumplimiento de requisitos funcionales y no funcionales» y «Justificación de decisiones y trade-offs»; debugging: «Identificación de la causa raíz» y «Corrección propuesta». La IA solo escribe los otros 2 criterios, propios del problema. En el editor de borradores los criterios fijos están bloqueados. Adaptarlos queda como HU-36 (diferida).
- **HU-04-7** Como docente/reclutador quiero que las respuestas correctas de las preguntas de verdadero o falso generadas queden balanceadas entre verdadero y falso, para que el banco no tenga sesgo hacia una de las dos. *(Explicitud: Media; decisión del autor al implementar HU-04-2)*
  - *Qué cambia:* Nueva. Funciona como HU-04-2: el servidor cuenta cuántos verdadero y falso hay en el banco, sortea la respuesta de cada ítem nuevo y la exige en el prompt; al regenerar se conserva la que tenía.

### HU-05 Puntuar ítems generados por IA

**Requisito:** RF-05

**Sprint:** Sprint 1

**Como** validador, **quiero** puntuar los ítems generados por IA de 1 a 5 estrellas, **para** dejar constancia de su calidad como pregunta.

**Criterios de aceptación:**
- Puedo asignar a un ítem una puntuación de 1 a 5 estrellas enteras (HU-05-2; reemplaza la escala 0.0 a 5.0 con un decimal).
- 1 estrella representa un ítem malo, 3 uno de calidad media y 5 uno bueno.
- La puntuación asignada queda guardada en el ítem.
- Un mismo ítem puede ser puntuado por distintos validadores.
- Cada puntuación individual es un número entero de estrellas (no hay medias estrellas).
- Un ítem sin puntuar se distingue de uno puntuado: no muestra estrellas sino un marcador (una estrella tachada).

**Refinamientos (audios del 30-10 y 06-11):**
- **HU-05-2** Como validador quiero puntuar los ítems de 1 a 5 estrellas enteras, para tener una escala simple. *(Explicitud: Alta; origen A-21)*
  - *Qué cambia:* **Reemplaza el criterio de la escala 0.0 a 5.0 con un decimal** ("para qué 3.5 y 3.7"). Afecta HU-25 (el promedio se muestra en estrellas, con decimales) y HU-07 (el ítem sin puntuar se muestra con una estrella tachada).

### HU-06 Crear ítems de una skill específica

**Requisito:** RF-06

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** crear ítems de una o varias skills indicando el nivel de responsabilidad y, por cada tipo de ítem, la cantidad y el tiempo estimado de cada ítem, **para** obtener ítems a la medida de lo que necesito evaluar.

**Criterios de aceptación:**
- Puedo elegir una skill, o añadir varias en una misma solicitud, o añadir las skills que yo marque de uno o varios roles SFIA (HU-06-4).
- Para cada skill indico el nivel de responsabilidad y, por cada tipo de ítem, la cantidad y el tiempo estimado de cada ítem.
- Se generan borradores de acuerdo con lo indicado.
- Para cada skill puedo indicar, de forma opcional, un contexto (empresa, cargo o curso) que se usa solo en sus ítems.

**Refinamientos (audios del 30-10 y 06-11, y decisiones del autor al implementar):**
- **HU-06-2** Como docente/reclutador quiero una explicación o un ejemplo al pasar el cursor sobre cada tipo de ítem, sobre «Cantidad» y sobre «Tiempo (min)» del formulario de generación, para entender qué configuro. *(Explicitud: Alta; origen A-03)*
  - *Qué cambia:* Pensado para quien solo es reclutador. **Implementado** como texto subrayado con puntos que muestra el tooltip al pasar el cursor (o al enfocarlo con el teclado). «Cantidad» y «Tiempo (min)» son títulos de columna que aparecen una sola vez, y cada tipo se muestra con su icono. Primero se probó un ícono «i»; se prefirió el hover.
- **HU-06-3** Como docente/reclutador quiero que el sistema me recomiende qué tipos de ítem son pertinentes para cada skill y nivel (por ejemplo en negrita), y poder generar otros bajo mi propio riesgo, para no pedir preguntas sin sentido. *(Explicitud: Alta; origen A-06)*
  - *Qué cambia:* Surge de un coding challenge de debugging poco razonable generado para una skill de diseño. **Diferida: queda como limitación** (ver `sprint-1.md`). El sistema no recomienda ni restringe los tipos por skill y nivel; el docente/reclutador es responsable de elegir tipos pertinentes. Una recomendación real requeriría una tabla por categoría de skill y nivel definida por un experto, o una consulta previa a la IA; ninguna está definida.
- **HU-06-4** Como docente/reclutador quiero añadir al formulario las skills de uno o varios roles SFIA, viendo los roles por familia y las skills core y related de cada uno por separado y marcando las que quiero, para armar lo que evalúo sin añadir las skills una a una. *(Explicitud: Alta; decisión del autor, relacionada con HU-11-2 y HU-11-3 del Sprint 2)*
  - *Qué cambia:* Nueva. **Implementado:** el botón «+ Añadir skills de un rol…» abre una ventana con las 21 familias de roles y sus roles. Al elegir un rol se ven sus skills core y related, **ninguna marcada de antemano**, cada una como una tarjeta con borde que se rellena con el color de su categoría al elegirla. Solo se añaden las marcadas, sin reemplazar lo que ya hay, y no se guarda de qué rol salieron: se pueden sumar skills de un rol y luego de otro. Las skills que ya están en el formulario aparecen rellenas, con el aviso «ya está en el formulario», y no se pueden quitar desde ahí. Reemplaza al desplegable «Rol SFIA», que precargaba y reemplazaba los recuadros. No incluye guardar las skills elegidas como un rol propio (HU-38, diferida).
- **HU-06-5** Como docente/reclutador quiero que el formulario de generación se lea con claridad (skill y nivel juntos, resumen con colores e iconos y un motivo cuando no puedo avanzar), para configurar sin dudas. *(Explicitud: Media; decisión del autor a partir de las pruebas del portal)*
  - *Qué cambia:* Nueva. **Implementado:** la skill se muestra solo con su nombre y el nivel de responsabilidad va junto a ella; el contexto se llama «Contexto para la skill»; el recuadro de tipos se titula «Tipos de ítem» y la columna de minutos «Tiempo (min)». Un recuadro minimizado y el Paso 2 «Resumen» muestran la skill con el color de su categoría y, por cada tipo, su icono, la cantidad y los minutos. Si no se puede pulsar «Siguiente» (no hay skills, o alguna no tiene ningún tipo marcado), la pantalla dice por qué. Todas las pantallas de Generar ítems usan el ancho completo de la plataforma.

### HU-07 Filtrar ítems por revisar

**Requisito:** RF-07

**Sprint:** Sprint 1

**Como** validador, **quiero** filtrar los ítems activos por skill, rol y puntuación, **para** encontrar rápido los que debo revisar.

**Criterios de aceptación:**
- Solo se listan los ítems activos y disponibles para expertos.
- Puedo filtrar por skill, eligiéndola en un menú agrupado por categoría y subcategoría, con buscador.
- Puedo filtrar por nivel de responsabilidad.
- Puedo filtrar por rol.
- Puedo filtrar por puntuación.
- Puedo distinguir los ítems sin puntuar de los puntuados: los sin puntuar muestran una estrella tachada en lugar de estrellas.
- El filtro por puntuación se aplica sobre el promedio (que puede tener decimales) con una barra de dos puntos que fija el mínimo y el máximo, de 1 a 5 estrellas. Con la barra completa (1 a 5) no se filtra y se incluyen los ítems sin puntuar; mover cualquier punto los excluye. Para ver solo los sin puntuar o solo los puntuados existe un filtro aparte.

### HU-08 Ver los atributos de un ítem

**Requisito:** RF-08

**Sprint:** Sprint 1

**Como** validador, **quiero** ver los atributos completos de un ítem, **para** decidir con información suficiente si lo apruebo.

**Criterios de aceptación:**
- Veo la skill a la que apunta el ítem.
- Veo su rúbrica.
- Veo el tiempo estimado.
- Veo la respuesta correcta.
- Veo el enunciado.

**Refinamientos (decisión del autor al implementar):**
- **HU-08-2** Como docente/reclutador y como validador quiero ver un ítem del banco con la misma vista que un borrador, separando lo que verá quien rinda de lo que solo ve el docente/reclutador, para saber cómo se presentará la pregunta. *(Explicitud: Media; decisión del autor, extiende HU-27-6)*
  - *Qué cambia:* Nueva. **Implementado:** el banco de ítems y el portal del experto usan el mismo componente que la revisión de borradores: «Lo que verá quien rinda» (marco azul, con el título de cada dato: enunciado, alternativas…) y «Solo para el docente/reclutador» (marco punteado: qué evalúa, respuesta correcta o de referencia y rúbrica como matriz). Se entiende que el experto también ve esa parte.

### HU-09 Gestionar el estado de un ítem

**Requisito:** RF-09

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** que los ítems tengan un estado (activo o inactivo), **para** saber cuáles puedo usar y cuáles ya no.

**Criterios de aceptación:**
- Un ítem está activo o inactivo.
- Un ítem activo se puede mostrar y usar, sin requerir validación de un experto.

### HU-10 Contar con distintos tipos de ítem

**Requisito:** RF-10

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** disponer de preguntas de alternativa única, de verdadero o falso y de desarrollo, coding challenges, system design y debugging, **para** evaluar distintas habilidades con el ejercicio adecuado.

**Criterios de aceptación:**
- El banco soporta los seis tipos de ítem: alternativa única, verdadero o falso, pregunta de desarrollo, coding challenge, system design y debugging.
- Cada versión de un ítem pertenece a uno de esos tipos.

### HU-15 Conservar mis ítems modificados *(fusionada en HU-26)*

**Requisito:** RF-15 (fusionado en RF-26; se conserva el número)

**Sprint:** Sprint 2 · Fusionada en HU-26

HU-15 se fusionó en HU-26: guardar el ítem modificado en el banco personal es consecuencia de versionarlo, y la privacidad de la versión nueva reutiliza la disponibilidad de HU-31. Sus dos criterios pasaron a HU-26.

### HU-25 Ver la puntuación de un ítem

**Requisito:** RF-25

**Sprint:** Sprint 1

**Como** docente/reclutador, **quiero** ver el promedio de las puntuaciones de un ítem y cuántas puntuaciones tiene, **para** saber qué tan bien valorado está y con cuánto respaldo al armar mi evaluación.

**Criterios de aceptación:**
- Veo el promedio de las puntuaciones del ítem en estrellas (entre 1 y 5). Cada puntuación es entera, pero el promedio puede tener decimales (por ejemplo, 3,7).
- Veo la cantidad de puntuaciones que recibió el ítem.
- Un ítem sin puntuar no muestra promedio: muestra una estrella tachada como marcador.
- Un ítem sin puntuar igual puede mostrarse y usarse si está activo.

### HU-26 Versionar un ítem al modificarlo o regenerarlo

**Requisito:** RF-26

**Sprint:** Sprint 2 · Probable (incluye HU-15)

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

### HU-27 Revisar los borradores antes de publicarlos

**Requisito:** RF-27

**Sprint:** Sprint 1

**Dónde:** Portal Docente/Reclutador › Generar ítems › Paso 3 "Revisa los borradores", que aparece al terminar de generar.

**Como** docente/reclutador, **quiero** revisar los borradores generados por la IA antes de publicarlos, **para** decidir qué ítems entran al banco.

**Criterios de aceptación:**
- Los borradores se muestran en pantalla con su enunciado, skill, nivel, tipo y tiempo estimado.
- Los borradores no se guardan en el banco hasta que los publico.
- Si la IA no resuelve un pedido, veo el motivo y puedo seguir con los demás.
- Mi trabajo sin publicar se conserva en el navegador si recargo la página o vuelvo a iniciar sesión.

**Refinamientos (audios del 30-10 y 06-11, implementados en el refinamiento del Sprint 1):**
- **HU-27-2** Como docente/reclutador quiero ver la pregunta completa de un borrador (en un modal o panel) sin entrar a "editar", y tener editar, regenerar y descartar arriba como iconos, para revisar con comodidad. *(Explicitud: Alta; origen A-16)*
  - *Qué cambia:* Se prefirió el modal o panel a las tarjetas desplegables. **Implementado** como panel: la lista de borradores a la izquierda y el elegido completo a la derecha, con editar, regenerar y descartar (o restaurar) como iconos arriba. Al editar se conserva el mismo orden de la vista: enunciado, lo que verá quien rinda, «qué evalúa», lo que solo ve el docente/reclutador y la rúbrica. El comentario para la IA al regenerar aparece debajo del borrador, a todo el ancho del panel.
- **HU-27-3** Como docente/reclutador quiero ver siempre en qué borrador voy y cuántos son (indicador fijo con número), para no perderme al revisar varios. *(Explicitud: Alta; origen A-17)*
  - *Qué cambia:* Propuesta: un panel con encabezado fijo. **Implementado:** el encabezado «Borrador N de M» queda siempre visible, con flechas para pasar al borrador anterior o siguiente.
- **HU-27-4** Como docente/reclutador quiero ver la rúbrica de un borrador como matriz (criterios en filas, niveles en columnas), para leerla como una rúbrica convencional. *(Explicitud: Alta; origen A-18)*
  - *Qué cambia:* Los criterios originales no mencionan la rúbrica entre los datos mostrados. Quedó abierto cómo mostrar tanto texto en la matriz. **Implementado:** una fila por criterio y una columna por nivel (puntajes 0 a 3), con celdas compactas y desplazamiento horizontal si hace falta.
- **HU-27-5** Como docente/reclutador quiero ver la rúbrica con la que se medirá cada ítem mientras armo la evaluación, para saber qué se evaluará. *(Explicitud: Alta; origen A-11)*
  - *Qué cambia:* Se pidió transparencia, aunque no se defina todavía si se podrá modificar. Aplica al armado de la evaluación (Sprint 2, ver HU-11); conserva el código de esta historia.
- **HU-27-6** Como docente/reclutador quiero distinguir visualmente lo que verá el alumno/postulante de lo que veo yo (marco o color), para saber cómo se presentará la pregunta al rendirla. *(Explicitud: Alta; origen A-19)*
  - *Qué cambia:* Hoy "se intuye más que se sabe". **Implementado:** el borrador se separa en «Lo que verá quien rinda» (marco azul, con el título de cada dato) y «Solo para el docente/reclutador» (marco punteado). El banco y el portal del experto usan la misma vista (HU-08-2).

### HU-28 Modificar un borrador antes de publicarlo

**Requisito:** RF-28

**Sprint:** Sprint 1

**Dónde:** Portal Docente/Reclutador › Generar ítems › Paso 3 › botón "Editar" de cada borrador.

**Como** docente/reclutador, **quiero** modificar un borrador antes de publicarlo, **para** ajustarlo sin esperar a armar una evaluación.

**Criterios de aceptación:**
- Puedo editar el enunciado, lo que evalúa, el tiempo estimado, la respuesta correcta o de referencia y la rúbrica.
- Se publica lo que edité.
- Lo editado debe cumplir las mismas reglas que lo generado por la IA (por ejemplo, la rúbrica tiene al menos 4 criterios, incluye los fijos del tipo y sus pesos suman 100); si no las cumple, no se publica nada y veo el motivo.
- Lo publicado queda como versión 1 del ítem.

### HU-29 Regenerar un borrador antes de publicarlo

**Requisito:** RF-29

**Sprint:** Sprint 1

**Dónde:** Portal Docente/Reclutador › Generar ítems › Paso 3 › botón "Regenerar" de cada borrador.

**Como** docente/reclutador, **quiero** regenerar un borrador con un comentario opcional, **para** obtener otra versión sin repetir todo el pedido.

**Criterios de aceptación:**
- Puedo pedir otra versión de un borrador, con un comentario opcional para la IA.
- La IA recibe el enunciado anterior para no repetirlo.
- El nuevo borrador reemplaza al anterior y no se guarda nada en el banco.

### HU-30 Descartar y restaurar borradores

**Requisito:** RF-30

**Sprint:** Sprint 1

**Dónde:** Portal Docente/Reclutador › Generar ítems › Paso 3 › botones "Descartar" y "Restaurar" de cada borrador.

**Como** docente/reclutador, **quiero** descartar los borradores que no sirven y deshacer un descarte, **para** publicar solo los que me convencen sin perder uno por error.

**Criterios de aceptación:**
- Puedo descartar un borrador y no se publica.
- Puedo restaurar un borrador descartado.
- El botón de publicar cuenta solo los borradores no descartados.

**Refinamientos (audios del 30-10 y 06-11, implementados en el refinamiento del Sprint 1):**
- **HU-30-2** Como docente/reclutador quiero que, al volver atrás desde la revisión de borradores, se descarten los borradores generados pero se conserve mi selección (skills, nivel, tipos), para generar otra tanda sin empezar de cero. *(Explicitud: Alta; origen A-15)*
  - *Qué cambia:* Hoy existe el botón descartar pero no volver; tras descartar un borrador el sistema redirige al inicio. **Implementado:** el botón «Volver» de la revisión pide confirmación, descarta los borradores generados y regresa al Paso 2 (Resumen) con los recuadros intactos.

### HU-31 Publicar los borradores y elegir su disponibilidad

**Requisito:** RF-31

**Sprint:** Sprint 1

**Dónde:** Portal Docente/Reclutador › Generar ítems › pie del Paso 3 (casilla y botón "Publicar N preguntas"), y después la pantalla "Publicación lista".

**Como** docente/reclutador, **quiero** publicar los borradores revisados y elegir si quedan disponibles para los expertos, **para** decidir qué comparto con los validadores y qué guardo solo para mí.

**Criterios de aceptación:**
- Publicar guarda los borradores no descartados como ítems activos y sin puntuar.
- Si marco "disponible para expertos", los validadores ven los ítems; si no, son de uso privado y solo los ve su autor.
- Tras publicar, la pantalla se bloquea y puedo generar más preguntas.
- En el banco, cada ítem muestra si es público (disponible para expertos) o privado.
- Si algún borrador no cumple las reglas, no se publica ninguno.

### HU-36 Adaptar la rúbrica base de un tipo de pregunta *(nueva, diferida)*

**Como** reclutador, **quiero** quitar o agregar criterios en la rúbrica base de un tipo de pregunta, **para** adaptarla a lo que valoro.

*(Explicitud: Media; origen A-10. Diferida: se aborda después de "esta vuelta", es decir, después de este año. Código provisorio.)*

### HU-37 Banco de ítems escaneable con iconos y colores *(nueva, Sprint 1 refinamiento)*

**Como** docente/reclutador, **quiero** que el banco use iconos y colores en vez de texto (tipo de ítem, nivel) y aproveche mejor el espacio, **para** escanearlo rápido.

*(Explicitud: Media; origen A-22. Código provisorio.)*

**Implementado:** en el banco y en la revisión de borradores, cada ítem muestra su tipo con un icono de color (12 `.svg` propios en `public/icons/`) y su nivel como una celda con el color de la categoría de la skill, con menos texto en cada fila. El Paso 1 usa los mismos iconos.

### HU-38 Guardar un rol propio con las skills elegidas *(nueva, Sprint 2)*

**Como** docente/reclutador, **quiero** guardar las skills que elegí como un rol personalizado, **para** reutilizarlo después sin volver a elegirlas.

*(Explicitud: Alta; decisión del autor al implementar HU-06-4. Diferida del Sprint 1 (requería almacenamiento nuevo: a quién pertenece el rol, si se comparte, si se edita o se borra); se incluye en el Sprint 2 junto con HU-11-3 y HU-12-2, que resuelven el mismo almacenamiento. Código provisorio, sin RF.)*

## 4. Constructor de evaluaciones

> HU-13 y HU-14 se aplican a ítems ya publicados en el banco, al armar una evaluación, y crean una versión nueva (HU-26). Modificar y regenerar un borrador antes de publicarlo se describe en HU-28 y HU-29.

### HU-11 Armar una evaluación

**Requisito:** RF-11

**Sprint:** Sprint 2 · Núcleo

**Como** docente/reclutador, **quiero** armar una evaluación con plantillas de perfiles SFIA y un editor visual drag-and-drop, **para** componerla sin trabajo manual.

**Criterios de aceptación:**
- Puedo partir de una plantilla de perfil SFIA.
- Puedo agregar y ordenar ítems con un editor visual drag-and-drop.
- El banco del constructor solo ofrece los ítems que cumplen las reglas (las skills de la evaluación y los niveles de cada una) y se puede ordenar y paginar. Para usar otra skill u otro nivel se cambian las reglas en el paso 1; ya no hay confirmaciones al agregar. *(Decisión del autor, 26/11/2026)*

**Refinamientos (audios del 30-10 y 06-11):**
- **HU-11-2** Como docente/reclutador quiero partir de un rol SFIA, ver sus skills con los niveles en que SFIA las define y restringir, para cada skill, los niveles que se evaluarán (por ejemplo, PROG de nivel 3 a 4), para que el banco se filtre según lo que quiero evaluar. *(Explicitud: Alta; origen A-23)*
  - *Qué cambia:* Los niveles se definen por skill, no por rol. Se dijo que esto limita mucho el banco. **Decisión del autor (25/11/2026):** el rango es de cada skill y no de toda la evaluación; por defecto es el que SFIA define para esa skill. Un rol solo define qué skills se incluyen: SFIA no especifica en qué nivel se aplica cada skill dentro de un rol, así que los niveles nunca son del rol.
- **HU-11-3** Como docente/reclutador quiero ver qué skills de un rol son core y cuáles related al añadirlas desde él (solo como ayuda para elegir) y agregar skills propias que no están en él, para armar mi versión del rol. Si agrego o quito skills, el rol pasa a ser un rol personalizado que puedo guardar. *(Explicitud: Alta; origen A-24)*
  - *Qué cambia:* Se acordó mostrar core y related por separado; saber cuál es related sirve también para análisis posterior. **Decisión del autor (25/11/2026):** en la evaluación ya no se distingue core y related (solo se ve al elegir desde el rol); guardar el rol personalizado es opcional (HU-38).
- **HU-11-4** Como docente/reclutador quiero configurar la duración total de la prueba, con la suma de los minutos de sus ítems como valor recomendado y libertad para subirla o bajarla (con un aviso si baja de esa suma), para ajustarla a mi caso. *(Explicitud: Media; origen B-07)*
  - *Qué cambia:* Decisión del autor (25/11/2026): reemplaza «no bajar de la definida por el sistema» por un aviso al bajar de la suma. Se relaciona con la pregunta al cliente sobre el tiempo máximo global.

### HU-12 Guardar como plantilla o publicar

**Requisito:** RF-12

**Sprint:** Sprint 2 · Núcleo

**Como** docente/reclutador, **quiero** guardar una evaluación como plantilla o publicarla, **para** reutilizarla o ponerla a disposición de quienes la rendirán.

**Criterios de aceptación:**
- Puedo guardar la evaluación como plantilla.
- Puedo publicar la evaluación.

**Refinamientos (audios del 30-10 y 06-11):**
- **HU-12-2** Como docente/reclutador quiero marcar mis plantillas como públicas o privadas, para que otros docentes las reutilicen. *(Explicitud: Alta; origen A-29)*
  - *Qué cambia:* **Contradice el supuesto S-6 del Sprint 2** ("la plantilla es privada"). Se comparó con el check "publicar para todos" de los ítems. **Una plantilla pública solo puede tener ítems públicos:** al hacerla pública se confirma hacer públicos los ítems propios privados; los ítems privados de otro docente lo impiden.
- **HU-12-3** Como docente/reclutador quiero que una evaluación pase por los estados borrador, lista/publicada y descartada, y poder descartarla para que deje de aparecer entre las disponibles, para ordenar mi trabajo. *(Explicitud: Alta; origen A-30, A-32)*
  - *Qué cambia:* Una evaluación publicada no se edita; si cambio algo es otra evaluación. Los estados son de la evaluación; la ejecución es otra cosa (ver HU-32).

### HU-13 Modificar un ítem manualmente

**Requisito:** RF-13

**Sprint:** Sprint 2 · Probable

**Como** docente/reclutador, **quiero** modificar manualmente un ítem generado, **para** ajustarlo según estime conveniente.

**Criterios de aceptación:**
- Puedo editar un ítem desde el banco de ítems: su enunciado, el contenido propio de su tipo, la rúbrica y el tiempo estimado. El tipo, la skill y el nivel no cambian.
- Lo que guardo cumple las mismas reglas que lo generado (por ejemplo, los pesos de la rúbrica suman 100).
- Mis cambios se guardan como una versión nueva del ítem (HU-26). Si el ítem es de otro docente, se guardan como una copia mía y el original no cambia (HU-15).
- Al guardar decido de nuevo si el ítem queda disponible para expertos.

### HU-14 Regenerar un ítem con un nuevo contexto

**Requisito:** RF-14

**Sprint:** Sprint 2 · Probable

**Como** docente/reclutador, **quiero** regenerar un ítem indicando un nuevo contexto, **para** obtener una variante más ajustada a mi caso.

**Criterios de aceptación:**
- Puedo indicar un nuevo contexto para un ítem (es obligatorio).
- La plataforma genera una vista previa del ítem con ese contexto; no se guarda nada hasta que confirmo.
- Al confirmar se guarda una versión nueva (HU-26) y el contexto indicado queda guardado junto con ella.
- La nueva versión mantiene el tipo, la skill, el nivel y el tiempo de la anterior, y en alternativa única y verdadero o falso, también la respuesta correcta (HU-14-2; reemplaza el criterio original que permitía cambiar el tipo).
- Si el ítem es de otro docente, se guarda como una copia mía (HU-15).

**Refinamientos (audios del 30-10 y 06-11):**
- **HU-14-2** Como docente/reclutador quiero regenerar un ítem cambiando solo su contexto (empresa o lenguaje) y que el tipo de ítem se mantenga, para hacer las mínimas modificaciones. *(Explicitud: Alta; origen A-26)*
  - *Qué cambia:* **Reemplaza el criterio 4 de HU-14** ("puede ser de un tipo distinto"). Guardar la versión nueva en el banco propio ya lo cubre HU-26 (que incluye HU-15).

### HU-16 Compartir una evaluación por link

**Requisito:** RF-16

**Sprint:** Sprint 2 · Núcleo

**Como** docente/reclutador, **quiero** obtener un link compartible al publicar una evaluación, **para** enviarlo a quienes deben rendirla.

**Criterios de aceptación:**
- Al publicar, se genera un link con un `share_token`.
- Puedo copiar y compartir el link.

**Refinamientos (audios del 30-10 y 06-11):**
- **HU-16-2** Como docente/reclutador quiero compartir la evaluación solo con una lista de correos que yo defino, para que respondan solo personas registradas. *(Explicitud: Alta; origen A-27)*
  - *Qué cambia:* Responde el pendiente CP-05 (quién puede abrir un link). Se acordó la lista de correos primero y el link abierto después.
- **HU-16-3** Como docente/reclutador quiero que cada persona invitada reciba un token único de acceso, con la misma vigencia que la ejecución, para que solo ella pueda contestar. *(Explicitud: Alta; origen B-04)*
  - *Qué cambia:* Se prefirió al login con Google por ser más simple. Afecta HU-17: el alumno/postulante entra con el token.
- **HU-16-4** Como docente/reclutador quiero que cada ejecución tenga siempre fecha de inicio y de cierre, y poder reprogramarlas, para controlar cuándo se puede rendir. *(Explicitud: Alta; origen B-03)*
  - *Qué cambia:* **Contradice el supuesto S-4 del Sprint 2** ("el link no caduca"). Responde la pregunta al cliente sobre apertura y cierre automáticos.

### HU-32 Crear y comparar ejecuciones de una evaluación *(nueva, Sprint 2, propuesta)*

**Como** docente/reclutador, **quiero** crear varias ejecuciones de una misma evaluación publicada (grupos o fechas distintas), independientes y en paralelo, ver cuántas personas han respondido en cada una y compararlas, **para** reutilizar la evaluación sin duplicarla.

*(Explicitud: Alta; origen A-31, B-01. Código provisorio, no tiene RF asociado todavía.)*

### HU-33 Ver si una evaluación tiene ejecuciones activas *(nueva, Sprint 2, propuesta)*

**Como** docente/reclutador, **quiero** ver si una evaluación publicada tiene ejecuciones activas, sin que eso cambie su estado, **para** saber cuándo está en uso.

**Criterios de aceptación:**
- Una ejecución activa impide modificar la evaluación.

*(Explicitud: Media; origen B-02. Código provisorio.)*

### HU-34 Generar una nueva ejecución para una persona específica *(nueva, posterior)*

**Como** docente/reclutador, **quiero** generar una nueva ejecución para una persona específica, **para** que pueda rendir de nuevo si tuvo un problema.

*(Explicitud: Alta; origen B-06. Código provisorio, sin RF. Depende de la ejecución de evaluaciones (HU-17 a HU-19), por eso queda fuera del Sprint 1 y del Sprint 2.)*

### HU-35 Marcar y filtrar preguntas discriminantes *(nueva, posterior)*

**Como** docente/reclutador, **quiero** marcar y filtrar las preguntas discriminantes (las que separan bien a los buenos seleccionados) al armar una evaluación, **para** elegir mejores preguntas.

*(Explicitud: Media; origen B-08. Código provisorio, sin RF. Es futuro: hoy no hay datos de resultados para calcularlo. Fuera del Sprint 1 y del Sprint 2.)*

## 5. Runtime

### HU-17 Iniciar una sesión desde un link

**Requisito:** RF-17

**Como** alumno/postulante, **quiero** iniciar una sesión de evaluación desde un link compartido, **para** rendir la evaluación que me enviaron.

**Criterios de aceptación:**
- Al abrir el link compartido puedo iniciar la sesión de evaluación.

### HU-18 Rendir los ítems de uno en uno con timer

**Requisito:** RF-18

**Como** alumno/postulante, **quiero** recibir los ítems de uno en uno con un timer en tiempo real, **para** concentrarme en un ítem a la vez y controlar mi tiempo.

**Criterios de aceptación:**
- La sesión muestra un ítem a la vez.
- Se muestra un timer en tiempo real durante la sesión.

### HU-19 Conservar mis intentos y respuestas

**Requisito:** RF-19

**Como** alumno/postulante, **quiero** que mis intentos y respuestas se guarden, **para** no perder mi trabajo.

**Criterios de aceptación:**
- Mis respuestas quedan guardadas.
- Mis intentos quedan registrados.

## 6. Corrección

### HU-20 Corrección de preguntas cerradas

**Requisito:** RF-20

**Como** docente/reclutador, **quiero** que las preguntas cerradas se corrijan automáticamente por comparación exacta, **para** no corregirlas a mano.

**Criterios de aceptación:**
- Una respuesta igual a la correcta se marca como correcta.
- Una respuesta distinta se marca como incorrecta.

### HU-21 Corrección de coding challenges

**Requisito:** RF-21

**Como** docente/reclutador, **quiero** que los coding challenges se corrijan con tests unitarios en un contenedor aislado, **para** verificar el código enviado sin riesgo para la plataforma.

**Criterios de aceptación:**
- El código enviado se ejecuta contra tests unitarios.
- La ejecución ocurre en un contenedor aislado.
- El resultado de los tests determina la corrección.

### HU-22 Recomendación de corrección para respuestas abiertas

**Requisito:** RF-22

**Como** docente/reclutador, **quiero** recibir una recomendación de corrección para las respuestas abiertas (preguntas de desarrollo, system design y debugging), **para** apoyar mi evaluación con un criterio basado en rúbricas.

**Criterios de aceptación:**
- La plataforma recomienda una corrección con LLM-as-judge.
- La recomendación se basa en rúbricas estructuradas.

### HU-23 Revisar manualmente los ítems

**Requisito:** RF-23

**Como** docente/reclutador, **quiero** revisar manualmente los ítems, **para** corregir los casos que la corrección automática no resuelve bien.

**Criterios de aceptación:**
- Puedo revisar manualmente un ítem corregido.

## 7. Reportes

### HU-24 Obtener reportes de resultados

**Requisito:** RF-24

**Como** docente/reclutador, **quiero** obtener reportes de cada evaluación, **para** interpretar el desempeño de quien la rindió.

**Criterios de aceptación:**
- El reporte incluye el puntaje final.
- El reporte incluye el desglose por skill SFIA (radar, gaps).
- El reporte incluye el proceso (tiempo, intentos, patrones).
- El reporte incluye el benchmarking (percentiles).
