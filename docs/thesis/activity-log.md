# Bitácora de actividades

| Campo     | Valor                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| Proyecto  | Plataforma de evaluación técnica y práctica para ingeniería de software basada en el marco SFIA |
| Autor(es) | Isaías Cabrera                                                                                  |

> Registro de las actividades realizadas, de la más reciente a la más antigua.

## 29/10/2026 al 30/10/2026 — Auditoría del frontend

**Objetivo:** revisar el frontend del Portal Docente y del Portal Validador, aplicar las modificaciones pedidas y dejar el Sprint 1 en el proyecto.

**Modificaciones**

1. **Menú de skills.** "+ Añadir skill" abre un menú con las skills agrupadas por categoría y subcategoría, con buscador, y con los niveles de responsabilidad en celdas de color según la categoría (estilo de la Figura 2). El mismo menú se usa para cambiar la skill de un recuadro y para filtrar el banco de ítems.
2. **Nivel de responsabilidad.** Solo se pueden elegir los niveles en que la skill está definida.
3. **Recuadros de skill.** Marcar un tipo de ítem ya no cambia la altura del recuadro; los minutos por defecto dependen del tipo (alternativa única 2, verdadero o falso 1, pregunta de desarrollo 8, debugging 15, coding 25, system design 30); los botones de expandir y minimizar pasan a ser símbolos a la derecha.
4. **Contexto por skill.** El contexto se escribe en el recuadro de cada skill (Paso 1) y el Paso 2 pasa a ser solo el resumen.
5. **Banco de ítems.** Etiqueta "público" o "privado" en cada ítem; la puntuación solo aparece (con estrella) cuando el ítem fue puntuado y va a la altura del nombre; los filtros incluyen el nivel de responsabilidad y la skill se elige con el menú.
6. **Catálogo SFIA.** El botón apunta a `https://sfia-online.org/en/sfia-9`.
7. **Prompt de generación.** El texto del prompt pasa a `modules/content-generation/content/generation/prompt.json`; la descripción de la skill se envía completa y es obligatoria.
8. **Datos.** Las 12 skills que no tenían categoría ni subcategoría quedaron completas, con la información del Summary Chart de SFIA 9.
9. **Roles.** Se agregó `isaias.cabrera.gauna@outlook.com` como reclutador y validador.

**Traslado al proyecto**

- El código del Sprint 1 pasó de `scratchpad/sprint1/` a `modules/` (identity, catalog-sfia, content-generation, llm-gateway, shared), `web/management-portal/`, `db/`, `tests/` y `tools/`. Las herramientas (`tools/run_all.sh`, `tools/run.sh`, `tools/run_python.sh`) se ajustaron a las rutas nuevas.
- La guía del código está en `docs/architecture/code-guide.md`.

**Resultado**

- 150 pruebas de pytest y 22 comprobaciones E2E más 7 escenarios de sesión, ejecutadas desde las nuevas rutas.

**Pendiente**

- Revisar desde el portal la calidad de los ítems generados con la IA real.

## 28/10/2026 — Conexión del módulo `llm` a Groq

**Objetivo:** probar la generación de ítems con una IA real y gratuita (hasta entonces solo se había probado con una IA simulada).

**Actividades**

1. Se evaluaron opciones de API gratuita y se eligió Groq.
2. Se creó la clave de API en Groq y se guardó en `.env` (`GROQ_API_KEY`).
3. Se adaptó el módulo `llm`: nuevo proveedor `groq.py` (endpoint compatible con OpenAI) y selector `provider.py` según `LLM_PROVIDER` (`groq` | `cli`). Variables nuevas: `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_REASONING_EFFORT`, `LLM_TEMPERATURE`.
4. Se creó `run_all.sh` para levantar todos los módulos y el portal (`--reiniciar`, `--detener`).
5. Se corrigió el error 404 del primer intento: el modelo `llama-3.3-70b-versatile` no está disponible en la cuenta. Se cambió el modelo por defecto a `openai/gpt-oss-120b` con `LLM_REASONING_EFFORT=low`, y se agregó `probar.py --modelos` para listar los modelos disponibles.

**Resultado**

- La generación con Groq funcionó en los 6 tipos de ítem (0,7 a 2,1 s cada uno).
- Verificación: pytest 147 pruebas OK; E2E 16 comprobaciones y 7 escenarios de sesión OK.

**Límites conocidos**

- Plan gratuito de Groq para `gpt-oss-120b`: 8.000 tokens/min y 200.000 tokens/día. El portal lanza 3 peticiones en paralelo y ante un 429 se reintenta (máx. 2 veces, hasta 30 s de espera).

**Pendiente**

- Probar la generación desde el portal con la IA real y revisar la calidad de los ítems.
