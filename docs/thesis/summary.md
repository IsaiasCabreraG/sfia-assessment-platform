# Resumen del Proyecto

**Título:** Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA

---

El proceso de selección actual en ingeniería de software presenta limitaciones críticas: las entrevistas técnicas tradicionales generan ansiedad de desempeño que distorsiona la medición real de competencias (Behroozi et al., 2020), y no existe estandarización basada en taxonomías reconocidas por la industria. Esto crea un gap entre la formación académica y las demandas laborales, dificultando el filtrado de talento y la educación orientada a las demandas de la industria.

**Objetivo General:** Desarrollar una plataforma web de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA (Skills Framework for the Information Age), que integre generación de contenidos asistida por IA validada por expertos, tutor socrático interactivo, con diferentes tipos de ejercicios, constructor visual de evaluaciones y evaluación automática dependiendo del tipo de ejercicio.

**Resultados comprometidos:** (1) Motor de generación de ítems (banco de preguntas, ejercicios técnicos y simulaciones socráticas) con flujo de validación experto (IA genera borradores + expertos validan); (2) Constructor de evaluaciones con plantillas de perfiles SFIA predefinidos y editor visual drag-and-drop (selección skills, pesos, timer, orden); (3) Runtime de ejecución unificado (modo práctica/oficial configurable por reclutador), entrega secuencial de ítems, timer real-time y persistencia de intentos; (4) Evaluación automática por categoría: tests unitarios para coding; LLM-as-judge con rúbricas estructuradas.

**Ventajas frente a alternativas:** A diferencia de plataformas de coding challenges genéricas , esta solución: (a) usa SFIA como taxonomía base estandarizada internacionalmente; (b) combina IA generativa + validación experta (no solo IA); (c) incluye tutor socrático para aprendizaje, no solo evaluación; (d) cubre diferentes tipos de ejercicio, no solo algoritmos; (e) ofrece constructor visual para las evaluaciones; (f) entrega calificación automática diferenciada por tipo de ejercicio con rúbricas estructuradas.

**Impactos:** Económico-sociales: Reducción de costos y tiempo en procesos de selección; mayor equidad al eliminar sesgo de ansiedad en entrevistas; alineación formación-industria. Científico-tecnológicos: Avances en LLM-as-judge con rúbricas estructuradas por categoría; arquitectura event-driven para evaluación asíncrona; integración SFIA en software educativo.
