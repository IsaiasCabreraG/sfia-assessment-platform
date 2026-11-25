# Sprint 1

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Versión   | 0.3                                                                                             |
| Fecha     | 25/11/2026                                                                                      |
| Autor(es) | Isaías Cabrera                                                                                  |
| Estado    | Borrador                                                                                        |

> Las historias de usuario están en `user-stories.md`. El modelo de datos está en `../architecture/sprint1-db.dbml` (Figura 3).

## 1. Objetivo y fechas

**Objetivo:** contar con una primera versión de la generación de ítems para poder probarla.

| Inicio     | Fin        |
| ---------- | ---------- |
| 16/10/2026 | 30/10/2026 |

Proyecto individual: no hay responsables ni estimación por HU.

## 2. Alcance

El Sprint 1 cubre el login, el catálogo SFIA y el banco de ítems. Contiene 16 historias: las 11 de la lista "Sprint 1" del tablero de Trello y HU-27 a HU-31, creadas durante el desarrollo.

| HU    | Título                                  | Módulo                   | Pantalla                                                          | Tablas principales                                            |
| ----- | --------------------------------------- | ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| HU-01 | Iniciar sesión con Google               | Identidad y Acceso       | Acceso de ambos portales                                          | `identity.users`, `user_roles`, `refresh_tokens`              |
| HU-02 | Consultar el catálogo SFIA              | Catálogo SFIA            | Docente › "Catálogo SFIA ↗" (enlace) y Generar ítems › Paso 1     | `catalog.skills`, `levels`, `role_profiles`, `role_profile_skills` |
| HU-03 | Asociar ítems a una skill y un nivel SFIA | Generación de Contenido | Banco de ítems (Docente) y lista de ítems (Validador)             | `content.items`, `item_versions`                              |
| HU-04 | Generar borradores con IA               | Generación de Contenido  | Generar ítems › botón "Generar" (Paso 2)                          | `content.generation_requests`, `item_versions`                |
| HU-05 | Puntuar ítems generados por IA          | Generación de Contenido  | Validador › detalle del ítem › "Tu puntuación"                    | `content.item_scores`                                         |
| HU-06 | Crear ítems de una skill específica     | Generación de Contenido  | Generar ítems › Pasos 1 y 2                                       | `content.generation_requests`                                 |
| HU-07 | Filtrar ítems por revisar               | Generación de Contenido  | Validador › filtros de la lista                                   | `content.items`, `item_scores`, `catalog.role_profile_skills` |
| HU-08 | Ver los atributos de un ítem            | Generación de Contenido  | Validador › detalle del ítem; Docente › Banco de ítems            | `content.item_versions` y extensiones por tipo, `rubric_*`    |
| HU-09 | Gestionar el estado de un ítem          | Generación de Contenido  | Docente › Banco de ítems › detalle › "Desactivar/Activar ítem"    | `content.items.status`                                        |
| HU-10 | Contar con distintos tipos de ítem      | Generación de Contenido  | Generar ítems › Paso 1 (tipos) y Banco de ítems                   | `content.item_versions.type` y extensiones por tipo           |
| HU-25 | Ver la puntuación de un ítem            | Generación de Contenido  | Lista y detalle del ítem (ambos portales)                         | `content.item_scores`                                         |
| HU-27 | Revisar los borradores antes de publicarlos | Generación de Contenido | Generar ítems › Paso 3                                         | — (los borradores viven en pantalla hasta publicar)           |
| HU-28 | Modificar un borrador antes de publicarlo | Generación de Contenido | Generar ítems › Paso 3 › "Editar"                               | — (en pantalla hasta publicar)                                |
| HU-29 | Regenerar un borrador antes de publicarlo | Generación de Contenido | Generar ítems › Paso 3 › "Regenerar"                            | — (en pantalla hasta publicar)                                |
| HU-30 | Descartar y restaurar borradores        | Generación de Contenido  | Generar ítems › Paso 3 › "Descartar/Restaurar"                    | — (en pantalla hasta publicar)                                |
| HU-31 | Publicar los borradores y elegir su disponibilidad | Generación de Contenido | Generar ítems › pie del Paso 3 y "Publicación lista"     | `content.generation_requests`, `items`, `item_versions`, extensiones por tipo, `rubric_*` |

## 3. Fuera del sprint

HU-11 a HU-24 y HU-26 quedan en el Backlog.

El modelo de datos incluye estructuras que ninguna HU del Sprint 1 usa: `item_versions.origin` (`regenerated`, `edited`) y `item_versions.version` (HU-26). El modelo las conserva como previsión.

## 4. Decisiones

- **Filtro por rol (HU-07):** se resuelve a través de las skills. Filtrar por un rol (perfil) devuelve los ítems cuya skill pertenece a ese perfil en `catalog.role_profile_skills`. `content.items` no guarda el rol.
- **Atributos de un ítem (HU-08):** en system design se muestran la rúbrica y la respuesta de referencia.
- **Borradores (HU-27 a HU-31):** se generan sin guardarse y se guardan al publicar; el trabajo sin publicar se conserva en el navegador.
- **Sesión (HU-01):** access token (JWT) de 1 hora y refresh token de 7 días, de un solo uso (rotación).
- **Catálogo SFIA (HU-02):** el portal enlaza al sitio oficial; las skills guardan su nivel mínimo y máximo.
- **IA (HU-04):** el módulo `llm` usa Groq (`openai/gpt-oss-120b`); la CLI `claude -p` queda como alternativa. El texto del prompt está en `modules/content-generation/content/generation/prompt.json`.
- **Log de IA (solo desarrollo):** para elegir el modelo y revisar la calidad de las respuestas, cada intento de generación puede quedar en `logs/ia/*.jsonl` (prompt completo, respuesta, validación, modelo, tokens y duración) y verse en un visor HTML. Se activa con `LOG_IA=1`, está apagado por defecto, no se sube a git y en producción debe estar apagado. `/ask` devuelve ahora el proveedor, el modelo, los tokens y los parámetros; lo que un proveedor no informa va como `--`. La anotación de respuestas queda para más adelante.
- **Contexto (HU-06):** se escribe por skill, en el Paso 1 («Contexto para la skill»); el Paso 2 es el resumen.
- **Balance de respuestas correctas (HU-04-2, HU-04-7):** el servidor sortea la correcta de cada ítem antes de pedirlo, con más probabilidad para las opciones menos usadas del banco (A a D en alternativa única; verdadero y falso en V/F), y el prompt la exige; si la IA no la respeta, se reintenta. Al regenerar se conserva. Una opción que dependa de otras solo puede ir en la última posición.
- **Rúbrica de los tipos abiertos (HU-04-4 a HU-04-6):** se piden en dos llamadas por pedido (ítems con rúbrica y, después, las respuestas de referencia). Lo que genera la IA tiene 4 criterios de peso 25: 2 fijos por tipo, con descriptores estáticos en `config/criterios-fijos.json` (lo leen el backend y el portal), y 2 escritos por la IA. Quien edita puede agregar criterios (mínimo 4, con los fijos y pesos que suman 100) y no puede modificar los fijos.
- **Selector de roles (HU-06-4):** las skills de un rol se añaden desde una ventana (familia → rol → skills core y related, ninguna marcada de antemano). Solo se añaden las marcadas, sin reemplazar lo que hay y sin guardar el rol de origen.
- **Vista de un ítem (HU-08-2, HU-27):** la revisión de borradores es un panel (lista y borrador completo) y no un modal. El borrador, el banco y el portal del experto usan la misma vista: «Lo que verá quien rinda» y «Solo para el docente/reclutador». El banco y la revisión muestran el tipo con un icono y el nivel con color (HU-37).
- **Interfaz (HU-06-2, HU-06-5):** la ayuda de cada tipo, de «Cantidad» y de «Tiempo (min)» aparece al pasar el cursor; todas las pantallas de Generar ítems usan el ancho completo y «Siguiente» explica por qué no se puede pulsar.
- **Plataforma:** el portal usa Next.js 16.4.6; el access token se valida con 10 segundos de tolerancia de reloj; el callback de Google espera hasta 15 segundos y, si la red falla, responde 502 con un mensaje claro en lugar de un error interno.
- **Puntuación (HU-05-2, HU-07, HU-25):** cada puntuación es de 1 a 5 estrellas enteras; el promedio puede tener decimales y se muestra en estrellas. Un ítem sin puntuar muestra una estrella tachada. El filtro del promedio es una barra de dos puntos (mínimo y máximo). Las puntuaciones anteriores (0.0 a 5.0) se redondearon con la migración `002_puntuacion_estrellas.sql`.

## 5. Limitaciones conocidas

- **Opciones que dependen de otras (HU-04):** al generar alternativa única con la IA, una opción como «todas las anteriores» o «A y B» solo puede ir en la última posición, y un detector de texto lo comprueba (letras A–D en mayúscula, «todas/ninguna/ambas de las anteriores», «las dos primeras», «opción B»). El detector no entiende el sentido: puede rechazar una opción legítima que contenga, por ejemplo, «A y B» con otro significado (se reintenta una vez) y puede dejar pasar una referencia redactada de otra forma. Además, una opción de este tipo solo puede ser la correcta cuando la correcta sorteada es la D, es decir, en aproximadamente 1 de cada 4 preguntas.
- **Recomendar tipos de ítem (HU-06-3):** el sistema no recomienda ni restringe los tipos de ítem por skill y nivel; el docente/reclutador elige. Una recomendación real requeriría una tabla por categoría de skill y nivel definida por un experto, o una consulta previa a la IA; ninguna está definida.
- **Guardar un rol propio (HU-38):** las skills elegidas desde un rol no se pueden guardar como un rol personalizado; hay que volver a elegirlas. Requiere almacenamiento nuevo (a quién pertenece, si se comparte, si se edita o se borra).
- **Adaptar la rúbrica base (HU-36):** los criterios fijos de cada tipo no se pueden cambiar desde la plataforma; se editan en `config/criterios-fijos.json`.

## 6. Pendiente

- Revisar desde el portal la calidad de los ítems generados con la IA real, con ayuda del log de IA.
- Anotar por ítem las respuestas del log (de acuerdo o en desacuerdo, con etiquetas de qué falló), separado del log.
