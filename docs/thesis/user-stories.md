# Historias de Usuario

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Versión   | 0.1                                                                                             |
| Fecha     | 21/10/2026                                                                                      |
| Autor(es) | Isaías Cabrera                                                                                  |
| Estado    | Borrador                                                                                        |

> Cada historia de usuario (HU-NN) desarrolla el requisito funcional del mismo número (RF-NN) de `requirements-elicitation.md`.

## 1. Autenticación

### HU-01 Iniciar sesión con Google

**Requisito:** RF-01

**Como** usuario, **quiero** iniciar sesión con mi cuenta de Google, **para** acceder a la plataforma sin crear otra credencial.

**Criterios de aceptación:**
- Existe la opción de iniciar sesión con Google (OIDC).
- Tras autenticarme con Google, accedo a la plataforma con mi cuenta.

## 2. Catálogo SFIA

### HU-02 Consultar el catálogo SFIA

**Requisito:** RF-02

**Como** docente/reclutador, **quiero** consultar el catálogo SFIA, **para** elegir las skills, los niveles y el perfil de rol que quiero evaluar.

**Criterios de aceptación:**
- El catálogo muestra las skills SFIA.
- El catálogo muestra los niveles de responsabilidad 1 a 7.
- El catálogo ofrece perfiles de rol predefinidos.

## 3. Banco de ítems

### HU-03 Asociar ítems a una skill y un nivel SFIA

**Requisito:** RF-03

**Como** docente/reclutador, **quiero** que cada ítem esté asociado a una skill y a un nivel SFIA, **para** saber qué competencia mide.

**Criterios de aceptación:**
- Todo ítem del banco está asociado a una única skill SFIA y a un nivel de responsabilidad.
- La skill y el nivel de un ítem son visibles al consultarlo.

### HU-04 Generar borradores con IA

**Requisito:** RF-04

**Como** docente/reclutador, **quiero** que la plataforma genere con IA borradores de preguntas, ejercicios y rúbricas, **para** no tener que redactar cada ítem desde cero.

**Criterios de aceptación:**
- La IA genera borradores de preguntas, de ejercicios y de rúbricas.
- Los borradores generados quedan sin puntuar.

### HU-05 Puntuar ítems generados por IA

**Requisito:** RF-05

**Como** validador, **quiero** puntuar los ítems generados por IA de 0.0 a 5.0, **para** dejar constancia de su calidad como pregunta.

**Criterios de aceptación:**
- Puedo asignar a un ítem una puntuación entre 0.0 y 5.0, con un decimal.
- 0.0 representa un ítem malo, 2.5 uno de calidad media y 5.0 uno bueno.
- La puntuación asignada queda guardada en el ítem.
- Un mismo ítem puede ser puntuado por distintos validadores.
- Un ítem sin puntuar es distinto de un ítem puntuado con 0.0.

### HU-06 Crear ítems de una skill específica

**Requisito:** RF-06

**Como** docente/reclutador, **quiero** crear ítems de una skill específica indicando el tiempo estimado, la cantidad de ítems y el nivel de responsabilidad, **para** obtener ítems a la medida de lo que necesito evaluar.

**Criterios de aceptación:**
- Puedo elegir una skill.
- Para esa skill indico el tiempo estimado, la cantidad de ítems y el nivel de responsabilidad.
- Se crean los ítems de acuerdo con lo indicado.

### HU-07 Filtrar ítems por revisar

**Requisito:** RF-07

**Como** validador, **quiero** filtrar los ítems activos por skill, rol y puntuación, **para** encontrar rápido los que debo revisar.

**Criterios de aceptación:**
- Solo se listan los ítems activos.
- Puedo filtrar por skill.
- Puedo filtrar por rol.
- Puedo filtrar por puntuación.
- Puedo distinguir los ítems sin puntuar de los que tienen puntuación 0.0.

### HU-08 Ver los atributos de un ítem

**Requisito:** RF-08

**Como** validador, **quiero** ver los atributos completos de un ítem, **para** decidir con información suficiente si lo apruebo.

**Criterios de aceptación:**
- Veo la skill a la que apunta el ítem.
- Veo su rúbrica.
- Veo el tiempo estimado.
- Veo la respuesta correcta.
- Veo el enunciado.

### HU-09 Gestionar el estado de un ítem

**Requisito:** RF-09

**Como** docente/reclutador, **quiero** que los ítems tengan un estado (activo o inactivo), **para** saber cuáles puedo usar y cuáles ya no.

**Criterios de aceptación:**
- Un ítem está activo o inactivo.
- Un ítem activo se puede mostrar y usar, sin requerir validación de un experto.

### HU-10 Contar con distintos tipos de ítem

**Requisito:** RF-10

**Como** docente/reclutador, **quiero** disponer de preguntas de alternativa única, de verdadero o falso y de desarrollo, coding challenges, system design y debugging, **para** evaluar distintas habilidades con el ejercicio adecuado.

**Criterios de aceptación:**
- El banco soporta los seis tipos de ítem: alternativa única, verdadero o falso, pregunta de desarrollo, coding challenge, system design y debugging.
- Cada versión de un ítem pertenece a uno de esos tipos.

### HU-15 Conservar mis ítems modificados

**Requisito:** RF-15

**Como** docente/reclutador, **quiero** que mis ítems modificados se guarden en un banco personal, **para** reutilizarlos en futuras evaluaciones.

**Criterios de aceptación:**
- Al modificar un ítem, la versión modificada se guarda en mi banco personal.
- Puedo consultar mi banco personal.

### HU-25 Ver la puntuación de un ítem

**Requisito:** RF-25

**Como** docente/reclutador, **quiero** ver el promedio de las puntuaciones de un ítem y cuántas puntuaciones tiene, **para** saber qué tan bien valorado está y con cuánto respaldo al armar mi evaluación.

**Criterios de aceptación:**
- Veo el promedio de las puntuaciones de 0.0 a 5.0 del ítem.
- Veo la cantidad de puntuaciones que recibió el ítem.
- Un ítem sin puntuar se distingue de uno con promedio 0.0.
- Un ítem sin puntuar igual puede mostrarse y usarse si está activo.

### HU-26 Versionar un ítem al modificarlo o regenerarlo

**Requisito:** RF-26

**Como** docente/reclutador, **quiero** que al modificar o regenerar un ítem se cree una nueva versión, **para** conservar la versión anterior junto con sus puntuaciones.

**Criterios de aceptación:**
- Al regenerar un ítem con un nuevo contexto, se crea una nueva versión.
- Al modificar un ítem manualmente, se crea una nueva versión.
- La versión anterior se conserva.
- Las puntuaciones quedan asociadas solo a la versión anterior.
- La nueva versión parte sin puntuar.
- Cada versión registra su origen: generada, regenerada o modificada manualmente.

## 4. Constructor de evaluaciones

### HU-11 Armar una evaluación

**Requisito:** RF-11

**Como** docente/reclutador, **quiero** armar una evaluación con plantillas de perfiles SFIA y un editor visual drag-and-drop, **para** componerla sin trabajo manual.

**Criterios de aceptación:**
- Puedo partir de una plantilla de perfil SFIA.
- Puedo agregar y ordenar ítems con un editor visual drag-and-drop.

### HU-12 Guardar como plantilla o publicar

**Requisito:** RF-12

**Como** docente/reclutador, **quiero** guardar una evaluación como plantilla o publicarla, **para** reutilizarla o ponerla a disposición de quienes la rendirán.

**Criterios de aceptación:**
- Puedo guardar la evaluación como plantilla.
- Puedo publicar la evaluación.

### HU-13 Modificar un ítem manualmente

**Requisito:** RF-13

**Como** docente/reclutador, **quiero** modificar manualmente un ítem generado, **para** ajustarlo según estime conveniente.

**Criterios de aceptación:**
- Puedo editar un ítem de la evaluación.
- Mis cambios quedan guardados en el ítem.

### HU-14 Regenerar un ítem con un nuevo contexto

**Requisito:** RF-14

**Como** docente/reclutador, **quiero** regenerar un ítem indicando un nuevo contexto, **para** obtener una variante más ajustada a mi caso.

**Criterios de aceptación:**
- Puedo indicar un nuevo contexto para un ítem.
- La plataforma genera una nueva versión del ítem con ese contexto.
- El contexto indicado queda guardado junto con la nueva versión.
- La nueva versión puede ser de un tipo distinto al de la versión anterior.

### HU-16 Compartir una evaluación por link

**Requisito:** RF-16

**Como** docente/reclutador, **quiero** obtener un link compartible al publicar una evaluación, **para** enviarlo a quienes deben rendirla.

**Criterios de aceptación:**
- Al publicar, se genera un link con un `share_token`.
- Puedo copiar y compartir el link.

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
