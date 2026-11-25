# Documento de Elicitación de Requisitos

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Versión   | 0.1                                                                                             |
| Fecha     | 18/10/2026                                                                                      |
| Autor(es) | Isaías Cabrera                                                                                  |
| Estado    | Borrador                                                                                        |

## Historial de cambios

| Versión | Fecha      | Autor          | Descripción     |
| ------- | ---------- | -------------- | --------------- |
| 0.1     | 18/10/2026 | Isaias Cabrera | Versión inicial |
| 0.2     | 28/10/2026 | Isaias Cabrera | Se agregan RF-27 a RF-31 (revisión de borradores antes de publicar); se ajustan RF-01, RF-02, RF-06 y RF-07 |

---

## 1. Introducción

### 1.1 Propósito

Este documento tiene como propósito mejorar la evaluación de habilidades en ingeniería de software, de modo que apoye tanto la contratación de personal como la validación de conocimientos académicos.

### 1.2 Alcance

Plataforma web de evaluación técnica y práctica de habilidades en ingeniería de software basada en SFIA, con generación de contenidos asistida por IA validada por expertos, constructor visual de evaluaciones, ejecución de evaluaciones y corrección automática diferenciada por tipo de ejercicio.

**Dentro del alcance:** login con Google, banco de ítems con validación experta, constructor visual, runtime de sesiones, corrección automática y revisión manual de casos fallidos.

**Fuera del alcance:** analítica avanzada, multi-tenancy, gestión de roles, integración de repos/PRs de GitHub para ejercicios tipo proyecto, tutor socrático y apoyo agéntico para la revisión de ítems por expertos.

## 2. Contexto del problema

### 2.1 Situación actual

Las entrevistas técnicas tradicionales generan ansiedad de desempeño que distorsiona la medición real de competencias (Behroozi et al., 2020). No existe estandarización basada en taxonomías reconocidas por la industria (`summary.md`).

### 2.2 Problema u oportunidad

Gap entre la formación académica y las demandas laborales, que dificulta el filtrado de talento y la educación orientada a la industria (`summary.md`).

### 2.3 Objetivos del sistema

**General:** desarrollar una plataforma web de evaluación técnica y práctica de habilidades en ingeniería de software basada en SFIA, que integre generación de contenidos asistida por IA con validación de expertos y corrección automática diferenciada según el tipo de ejercicio (`objectives.md`).

**Específicos:** OE1 caracterizar el dominio y levantar requerimientos; OE2 diseñar la arquitectura y el proceso de desarrollo; OE3 construir el módulo de generación y composición de evaluaciones; OE4 construir el módulo de ejecución y corrección; OE5 validar la plataforma.

### 2.4 Justificación

Impactos declarados en `summary.md`: menor costo y tiempo en selección, mayor equidad al reducir el sesgo de ansiedad, alineación formación-industria, avances en LLM-as-judge con rúbricas y en integración de SFIA en software educativo.

## 3. Stakeholders

| ID    | Stakeholder / Rol                | Responsabilidad                                                                      |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------ |
| ST-01 | Reclutador                       | Crea y comparte evaluaciones para seleccionar un candidato para un puesto de trabajo |
| ST-02 | Docente                          | Crea y comparte evaluaciones para evaluar conocimientos de sus alumnos               |
| ST-03 | Estudiante                       | Rinde evaluaciones con fines de aprendizaje                                          |
| ST-04 | Postulante                       | Rinde evaluaciones en un proceso de selección                                        |
| ST-05 | Experto validador                | Aprueba o rechaza los ítems generados por IA                                         |
| ST-06 | Académicos del proyecto Fondecyt | Participan en la elicitación (OE1)                                                   |
| ST-07 | Patrocinante                     | Valida la especificación de requerimientos y el documento de arquitectura            |

## 4. Plan de elicitación

| ID    | Técnica                                             | Fecha | Objetivo                                                                                   |
| ----- | --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| EL-01 | Revisión de literatura                              |       | Evaluación de competencias en ingeniería de software, SFIA, impacto de la IA en las skills |
| EL-02 | Análisis de documentos (comparativo de plataformas) |       | Estado del arte de plataformas de evaluación técnica y certificadores SFIA                 |
| EL-03 | Entrevistas / reuniones de elicitación              |       |                                                                                            |
| EL-04 | Prototipo / mock-up                                 |       |                                                                                            |

## 5. Resultados de la elicitación

### 5.1 Sesión EL-03

- **Fecha:** 16/10/2026
- **Participantes:** Isaías Cabrera (desarrollador), Valeria Henríquez (copatrocinante y cliente), Juan Pablo Salazar (patrocinante)
- **Hallazgos / necesidades:**
  - Los ítems se crean por skill: el docente/reclutador indica por cada skill el tiempo estimado, la cantidad de ítems y el nivel de responsabilidad (RF-06).
  - El validador necesita revisar los ítems pendientes: filtrarlos por skill, rol y estado (RF-07) y ver sus atributos completos: skill objetivo, rúbrica, tiempo estimado, respuesta correcta y enunciado (RF-08).
  - El docente/reclutador debe poder intervenir los ítems generados, ya sea modificándolos manualmente (RF-13) o regenerándolos con un nuevo contexto (RF-14).
  - Los ítems modificados se conservan en un banco personal del docente/reclutador (RF-15).

<!-- Repetir por cada sesión. -->

## 6. Requisitos identificados

> Los requisitos de abajo salen de la revisión de literatura, la elicitación de requisitos y la idea inicial del proyecto.

### 6.1 Requisitos funcionales

| ID    | Actor              | Módulo         | Descripción                                                                                                                                                       |
| ----- | ------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-01 | Usuario            | Autenticación  | El usuario puede iniciar sesión con su cuenta de Google (OIDC) y mantener su sesión sin volver a entrar mientras la usa. |
| RF-02 | Sistema            | Catálogo SFIA  | El sistema ofrece el catálogo SFIA (skills con sus niveles mínimo y máximo, niveles 1-7 y perfiles de rol predefinidos) y el portal remite a su sitio oficial.                                                                           |
| RF-03 | Sistema            | Banco de ítems | El sistema asocia cada ítem a una skill y a un nivel de responsabilidad SFIA.                                                                                     |
| RF-04 | Sistema            | Banco de ítems | El sistema genera con IA borradores de preguntas, ejercicios y rúbricas.                                                                                          |
| RF-05 | Validador          | Banco de ítems | El validador puede puntuar de 1 a 5 estrellas enteras los ítems generados por IA (1 estrella mala, 3 media, 5 buena pregunta). Un mismo ítem puede ser puntuado por distintos validadores. |
| RF-06 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede generar ítems de una o varias skills, indicando por cada skill el nivel de responsabilidad y, por cada tipo de ítem, la cantidad y el tiempo estimado de cada ítem, y un contexto opcional por skill. |
| RF-07 | Validador          | Banco de ítems | El validador puede filtrar los ítems activos y disponibles para expertos por skill, rol (a través de las skills del perfil), nivel de responsabilidad y puntuación, distinguiendo los ítems sin puntuar de los puntuados.                    |
| RF-08 | Validador          | Banco de ítems | El validador puede ver los atributos de un ítem: la skill a la que apunta, su rúbrica, el tiempo estimado, la respuesta correcta y el enunciado.                  |
| RF-09 | Sistema            | Banco de ítems | El sistema maneja los estados activo e inactivo de los ítems.                                                                                                     |
| RF-10 | Sistema            | Banco de ítems | El sistema soporta los tipos alternativa única, verdadero o falso, pregunta de desarrollo, coding challenge, system design y debugging.                           |
| RF-11 | Docente/Reclutador | Constructor    | El docente/reclutador puede armar una evaluación con plantillas de perfiles SFIA y un editor visual drag-and-drop.                                                |
| RF-12 | Docente/Reclutador | Constructor    | El docente/reclutador puede guardar una evaluación como plantilla o publicarla.                                                                                   |
| RF-13 | Docente/Reclutador | Constructor    | El docente/reclutador puede modificar un ítem manualmente según estime conveniente.                                                                               |
| RF-14 | Docente/Reclutador | Constructor    | El docente/reclutador puede regenerar un ítem con un nuevo contexto, manteniendo su tipo.                                                                    |
| RF-15 | Sistema            | Banco de ítems | El sistema guarda los ítems modificados por un docente/reclutador en su banco de ítems personal. **Fusionado en RF-26.**                                          |
| RF-16 | Sistema            | Constructor    | El sistema genera un link compartible con `share_token` al publicar una evaluación.                                                                               |
| RF-17 | Alumno/Postulante  | Runtime        | El alumno/postulante puede iniciar una sesión de evaluación desde un link compartido.                                                                             |
| RF-18 | Sistema            | Runtime        | El sistema entrega los ítems de uno en uno con timer en tiempo real durante la sesión.                                                                            |
| RF-19 | Sistema            | Runtime        | El sistema persiste los intentos y las respuestas.                                                                                                                |
| RF-20 | Sistema            | Corrección     | El sistema corrige las preguntas cerradas por comparación exacta.                                                                                                 |
| RF-21 | Sistema            | Corrección     | El sistema corrige los coding challenges con tests unitarios en contenedor aislado.                                                                               |
| RF-22 | Sistema            | Corrección     | El sistema recomienda una corrección para las respuestas abiertas (preguntas de desarrollo, system design y debugging) con LLM-as-judge y rúbricas estructuradas. |
| RF-23 | Docente/Reclutador | Corrección     | El docente/reclutador puede revisar manualmente los ítems.                                                                                                        |
| RF-24 | Sistema            | Reportes       | El sistema genera reportes con puntaje final, desglose por skill SFIA (radar, gaps), proceso (tiempo, intentos, patrones) y benchmarking (percentiles).           |
| RF-25 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede ver el promedio de las puntuaciones de un ítem y la cantidad de puntuaciones que recibió.                                             |
| RF-26 | Sistema            | Banco de ítems | El sistema crea una nueva versión del ítem al regenerarlo con un nuevo contexto o modificarlo a mano, y registra su origen; las puntuaciones quedan solo en la versión anterior. La versión nueva queda en el banco personal del docente/reclutador (RF-15); si el ítem es de otro docente, el sistema crea una copia propia y el original no cambia. |
| RF-27 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede revisar los borradores generados por la IA antes de publicarlos; no se guardan hasta que los publica. |
| RF-28 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede modificar un borrador antes de publicarlo. |
| RF-29 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede regenerar un borrador antes de publicarlo, con un comentario opcional para la IA. |
| RF-30 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede descartar y restaurar borradores antes de publicarlos. |
| RF-31 | Docente/Reclutador | Banco de ítems | El docente/reclutador puede publicar los borradores revisados y elegir si quedan disponibles para expertos o de uso privado. |

### 6.2 Requisitos no funcionales

| ID  | Categoría | Descripción |
| --- | --------- | ----------- |
|     |           |             |

### 6.3 Restricciones y reglas de negocio

| ID    | Descripción                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| RN-01 | Los contenidos los genera la IA y pueden ser validados por un experto; no todos requieren validación (modelo híbrido) |
| RN-02 | SFIA es la taxonomía base: skills con niveles de responsabilidad 1-7                                                  |
| RN-03 | Reclutador y Docente son usuarios equivalentes: la evaluación no cambia por tipo de usuario                           |
| RN-04 | La evaluación lleva un único campo "Contexto" (empresa, cargo o curso)                                                |
| RN-05 | El docente/reclutador decide qué sesión cuenta como oficial                                                           |
| RN-06 | La corrección automática tiene límites: no cubre todo tipo de ejercicio                                               |
| RN-07 | GitHub se usa solo como repositorio y CI/CD del desarrollo, no como integración del producto                          |

### 6.4 Supuestos y dependencias

| ID     | Tipo        | Descripción                                                                                   |
| ------ | ----------- | --------------------------------------------------------------------------------------------- |
| SUP-01 | Dependencia | Proveedor de LLM (genérico, por definir) para generación de contenido y evaluación automática |
| SUP-02 | Dependencia | Google (OIDC) para el login                                                                   |
| SUP-03 | Dependencia | Taxonomía oficial SFIA (carga inicial, import periódico)                                      |
| SUP-04 | Supuesto    | Disponibilidad de expertos para validar ítems                                                 |
| SUP-05 | Supuesto    | Disponibilidad de estudiantes para el piloto (20-60 por semestre)                             |

## 7. Conflictos, ambigüedades y pendientes

| ID    | Descripción                                                                                                                | Requisitos afectados | Resolución propuesta | Estado  |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- | ------- |
| CP-01 | Multi-tenancy sin decidir                                                                                                  |                      |                      | Abierto |
| CP-02 | Categorización de métodos de evaluación por tipo de ejercicio, pendiente                                                   | RF-20, RF-21, RF-22  |                      | Abierto |
| CP-03 | Definición del MVP                                                                                                         |                      |                      | Abierto |
| CP-04 | Organización de la BD y del acceso de cada módulo, sin decidir                                                             |                      |                      | Abierto |
| CP-05 | Quién puede abrir un link compartido, sin decidir                                                                          | RF-16, RF-17         |                      | Abierto |
| CP-06 | Roles teacher / student / candidate: es una suposición, sin confirmar. Además, `objectives.md` difiere la gestión de roles |                      |                      | Abierto |
| CP-07 | `modules.md` define memberships y roles, pero `objectives.md` deja fuera la gestión de roles y la multi-tenancy            |                      |                      | Abierto |

## 8. Validación y trazabilidad

### 8.1 Validación con stakeholders

<!-- Cómo y cuándo se confirmaron los requisitos. -->

### 8.2 Matriz de trazabilidad

| Requisito | Fuente (sesión / stakeholder) | Validado por | Fecha |
| --------- | ----------------------------- | ------------ | ----- |
| RF-01     |                               |              |       |
