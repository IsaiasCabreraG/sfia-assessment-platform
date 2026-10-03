# Objetivos del Proyecto de Tesis

Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA.

---

## Objetivo General

Desarrollar una plataforma web de evaluación técnica y práctica de habilidades en ingeniería de software basada en el marco SFIA, que integre generación de contenidos asistida por IA con validación de expertos, y corrección automática diferenciada según el tipo de ejercicio.

---

## Objetivos Específicos

### OE1 — Caracterizar el dominio y levantar requerimientos

Caracterizar las habilidades de ingeniería de software y su evaluación actual —incluido el efecto de la inteligencia artificial en las competencias— mediante revisión de literatura, análisis comparativo de herramientas existentes y elicitación de requerimientos con los interesados, produciendo la especificación de requerimientos de la plataforma.

**Actividades:**
- Revisión de literatura sobre evaluación de competencias en ingeniería de software, marcos de habilidades (SFIA) e impacto de la IA en las skills
- Análisis comparativo de plataformas de evaluación técnica y herramientas de certificación SFIA (estado del arte)
- Entrevistas/reuniones de elicitación con académicos del proyecto Fondecyt y otros interesados
- Síntesis y elaboración del documento de especificación de requerimientos, validado con el patrocinante

### OE2 — Diseñar la arquitectura y el proceso de desarrollo

Diseñar la arquitectura de software y el proceso de desarrollo de la plataforma a partir de la especificación de requerimientos, definiendo su descomposición modular, modelo de datos y stack tecnológico.

**Actividades:**
- Refinamiento de la arquitectura lógica de módulos ya avanzada (7 módulos: catálogo SFIA, generación de contenido, constructor, ejecución, evaluación automática, analítica, identidad) y de los 2 portales web (Gestión y Postulante)
- Diagramas C4 (contexto y contenedores) y modelo de datos por módulo
- Definición de contratos entre módulos (APIs REST, eventos de dominio)
- Selección del stack tecnológico por módulo
- Definición del proceso de desarrollo (metodología, flujo de trabajo con Git, ambientes)
- Configuración del repositorio GitHub e integración continua (CI/CD con GitHub Actions: builds, tests y despliegue automáticos)
- Documento de arquitectura aprobado por el patrocinante

### OE3 — Construir el módulo de generación y composición de evaluaciones

Construir el software que permita diseñar evaluaciones alineadas al marco SFIA: banco de ítems con generación asistida por IA, flujo de validación experta, simulaciones socráticas y constructor visual de evaluaciones basado en perfiles de skills.

**Actividades:**
- Implementación de autenticación mediante login con Google (base transversal de la plataforma)
- Implementación del banco de ítems (preguntas, ejercicios técnicos, simulaciones) con versionado y estados (draft/validado/deprecado)
- Integración de generación asistida por IA para borradores de preguntas, ejercicios y rúbricas
- Implementación del flujo de validación experta (experto aprueba/rechaza ítems generados)
- Implementación de simulaciones socráticas (tutor conversacional guiado por LLM)
- Constructor visual de evaluaciones: plantillas de perfiles SFIA + editor drag-and-drop (skills, pesos, orden, timer)
- Mapeo de ítems a skills y niveles SFIA

### OE4 — Construir el módulo de ejecución y corrección de evaluaciones

Construir el software que permita ejecutar evaluaciones y corregirlas: runtime de sesiones con entrega secuencial de ítems y control de tiempo, calificación automática diferenciada por tipo de ejercicio (tests unitarios y LLM-as-judge con rúbricas), y revisión manual de casos fallidos.

**Actividades:**
- Implementación del runtime de sesiones (iniciar sesión, entrega de ítems uno a uno, timer en tiempo real, persistencia de intentos y respuestas)
- Modo unificado práctica/oficial (el evaluador decide qué sesión cuenta como oficial)
- Calificación automática de preguntas cerradas (comparación exacta)
- Calificación automática de coding challenges mediante tests unitarios en contenedor aislado
- Calificación automática de respuestas abiertas (system design, debugging, proyectos) mediante LLM-as-judge con rúbricas estructuradas
- Revisión manual de casos fallidos (cola de corrección para ítems que la corrección automática no pudo resolver)

### OE5 — Validar la plataforma

Validar la plataforma en tres dimensiones: usabilidad con usuarios reales, cumplimiento de los requerimientos especificados, y confiabilidad de la corrección automática medida como acuerdo con evaluadores humanos.

**Actividades:**
- Diseño del plan de validación (métricas, sujetos, instrumentos)
- Validación de usabilidad mediante piloto con estudiantes (20-60 por semestre) y/o focus groups
- Verificación de cumplimiento de requerimientos (trazabilidad requisito → funcionalidad)
- Experimento de acuerdo corrección automática vs. evaluadores humanos sobre al menos 3 tipos de ejercicio
- Análisis de resultados e implementación de mejoras derivadas de la validación

---

## Notas de coherencia con el formulario

- **OG** = versión corta del resumen (ya en Word): incluye SFIA, IA+expertos, corrección diferenciada.
- **OE1** consume el estado del arte ya escrito (sección b) y `competitors.md`; produce los requerimientos que **OE2** consume. La validación experta de contenidos (diferenciador ii) vive en **OE3**; el tutor socrático (diferenciador iv) vive en **OE3**; LLM-as-judge (impacto científico) vive en **OE4** y su validación en **OE5**.
- **Resultados comprometidos del resumen** (4): motor de generación → OE3; constructor visual → OE3; runtime de ejecución → OE4; evaluación automática → OE4.
- **"Calificación manual"** quedó como "revisión manual de casos fallidos" (coherente con `EvaluationFailed` en la arquitectura y con que la corrección automática "no cubre todo").
- **GitHub** se usa solo como repositorio y agente de CI/CD (infraestructura de desarrollo, OE2), no como integración del producto. La autenticación del producto es login con Google (OE3).
- **Gestión de distintos tipos de usuarios (roles)** diferida: si el tiempo alcanza, se agrega como actividad en una iteración futura.
- Fuera de alcance (decisión de scope): analítica avanzada, multi-tenancy, gestión de roles — no aparecen en resumen ni aquí. La única pieza de identidad en alcance es el login con Google.
