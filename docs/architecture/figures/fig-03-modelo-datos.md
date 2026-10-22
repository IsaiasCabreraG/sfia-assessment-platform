# Figura 3 — Modelo de datos del Sprint 1

**Archivos:** `fig-03-modelo-datos.html` (fuente) · `fig-03-modelo-datos.png` (render, 2400×1400 px)

**Fuente de contenido:** `../item-types-dictionary.md` (diccionario de tipos de ítem) y `../sprint1-db.dbml` (modelo de datos del Sprint 1)

## Propósito

Mostrar las tablas de la base de datos que necesita el Sprint 1 (login, catálogo SFIA y banco de ítems), agrupadas en un schema por módulo, con sus columnas, claves y relaciones entre tablas.

## Elementos

### Schemas y tablas

| Schema | Módulo | Tablas |
|---|---|---|
| `identity` | Identidad y Acceso | `users`, `user_roles`, `refresh_tokens` |
| `catalog` | Catálogo SFIA | `skills`, `levels`, `role_profiles`, `role_profile_skills` |
| `content` | Generación de Contenido | `generation_requests`, `items`, `item_versions`, `item_scores`, las tablas de extensión por tipo (`item_choice_options`, `item_true_false`, `item_open_question`, `item_coding`, `item_system_design`, `item_debugging`, `item_findings`) y la rúbrica (`rubric_criteria`, `rubric_levels`) |
| `events` | Compartido | `events` (event store) |

### Estructura del banco de ítems

| Capa | Tabla | Contenido |
|---|---|---|
| Identidad | `items` | Estado (activo/inactivo), skill y autor. No cambia entre versiones |
| Versión | `item_versions` | Tipo, número de versión, origen (`generated`, `regenerated`, `edited`), pedido de generación, nivel, tiempo, objetivo y enunciado |
| Extensión | tabla según el tipo | Datos propios del tipo. Cada versión tiene su fila en la tabla de su tipo |
| Rúbrica | `rubric_criteria`, `rubric_levels` | Criterios con peso y descriptores de 0 a 3. Solo en tipos abiertos (`open_question`, `system_design`, `debugging`) |
| Puntuación | `item_scores` | Puntuación de 0.0 a 5.0 de un validador sobre una versión |
| Contexto | `generation_requests` | Pedido de generación o de regeneración, con su contexto |

## Relaciones (leyenda de flechas)

Las flechas van de la tabla que tiene la clave foránea a la tabla referenciada.

| Color | Significado |
|---|---|
| Azul | FK dentro del mismo schema |
| Turquesa | FK de `content` o de `catalog` hacia `catalog` (`skill_id`, `level`) |
| Naranja | FK hacia `identity` (`requested_by`, `created_by`, `validator_id`, `user_id`) |

El tronco que baja desde `item_versions` agrupa las FK `item_version_id` de las tablas de extensión, de `item_findings` y de `rubric_criteria`.

Dependencias entre schemas: `content` depende de `catalog` e `identity`; estos dos no dependen de nadie. `events` no tiene FK, porque su `aggregate_id` apunta a agregados de distintos módulos.

## Cómo regenerar el PNG

Desde Windows con Edge instalado:

```
msedge --headless --hide-scrollbars --window-size=2400,1400 --screenshot=fig-03-modelo-datos.png file:///<ruta>/fig-03-modelo-datos.html
```

## Notas

- Las reglas que la base de datos no cubre (por ejemplo, que los pesos de la rúbrica sumen 100 o que una pregunta de alternativa única tenga una sola opción correcta) las valida la aplicación y no aparecen en la figura.
- El diagrama muestra el modelo del Sprint 1. No incluye las tablas de los módulos posteriores (Constructor, Ejecución, Evaluación Automática y Analítica).
