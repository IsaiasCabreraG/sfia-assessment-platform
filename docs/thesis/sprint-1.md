# Sprint 1

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Versión   | 0.2                                                                                             |
| Fecha     | 28/10/2026                                                                                      |
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
- **Contexto (HU-06):** se escribe por skill, en el Paso 1; el Paso 2 es solo el resumen.

## 5. Pendiente

- Revisar desde el portal la calidad de los ítems generados con la IA real.
