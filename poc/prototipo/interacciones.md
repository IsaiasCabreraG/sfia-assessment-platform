# Prototipo de frontend: especificación de interacciones

Prototipo de interfaz del Portal de Gestión con conexiones backend básicas.
Stack del frontend: React (el de la PoC). Usuarios: Reclutador y Docente, equivalentes
(la evaluación no cambia según el tipo de usuario).

## Interacción 1: Generar preguntas con LLM

Objetivo: el usuario completa un formulario y el LLM devuelve borradores de ítems
de evaluación para que los revise.

### Paso 1. Qué evaluar
Se arma con un recuadro por skill.

**Rol SFIA.** Selector con valor por defecto "Rol personalizado". Al elegir un rol se crean sus
recuadros, ya minimizados (pide confirmación si había recuadros). Volver a "Rol personalizado"
conserva los recuadros. El botón "Guardar rol", a la derecha del selector, guarda los recuadros
actuales (con su configuración completa) bajo un nombre y el rol aparece como "(guardado)".

**Recuadros.** El selector "+ Añadir skill…" crea un recuadro con la skill elegida; la × lo
quita. Se puede repetir una skill. Cada recuadro se expande y se minimiza (también "Expandir
todo" / "Minimizar todo"). Minimizado muestra código, nivel y un resumen.

| Campo del recuadro | Tipo | Detalle |
|---|---|---|
| Skill | Selector | Código y nombre SFIA. |
| Nivel de responsabilidad | Selector | 1-7. |
| Tipos de ejercicio | Multiselección | Pregunta de alternativas, coding, system design, debugging/code review, proyecto. |
| Cantidad por tipo | Número | Cuántos ítems pedir de cada tipo seleccionado. |
| Dificultad | Selector | Básica, media, alta. |
| Tiempo estimado por ítem | Número (min) | Alimenta el timer del Constructor. |

Un recuadro nuevo trae 2 preguntas de alternativas, dificultad media y 20 min. Para avanzar
hace falta al menos un recuadro, cada uno con al menos un tipo.

### Paso 2. Contexto
| Campo | Tipo | Detalle |
|---|---|---|
| Contexto | Texto + archivo | Empresa, cargo o curso (industria, producto, cultura, escala). |
| Descripción del cargo | Texto + archivo | Job Description o equivalente. |
| Stack tecnológico | Tags | Lenguajes, frameworks y herramientas que deben aparecer. |
| Documentos de referencia | Varios archivos | Estándares internos, arquitectura, syllabus. Fuente para no inventar. |
| Restricciones e instrucciones extra | Texto | Temas a evitar, idioma, tono, formato. |

### Paso 3. Resumen y generación
- Resumen de lo ingresado (una línea por skill), con enlace para volver a cada paso.
- Botón "Generar": llama al backend y muestra estado de carga.

### Resultado: revisión de borradores (autor)
Cada borrador trae: enunciado, skill, nivel, tipo, dificultad, rúbrica, criterios de
aceptación y estado (`borrador` o `descartado`). Acciones por borrador: editar, regenerar,
descartar (y restaurar un descartado). La aprobación no es del autor, sino del revisor.
- Regenerar abre un cuadro de feedback opcional que se agrega al prompt del LLM.
- Al final, la casilla "Dejar las preguntas a disposición de expertos para evaluar" (desmarcada
  = uso privado) y el botón "Publicar N preguntas", que publica los borradores no descartados.
  Tras publicar, la pantalla se bloquea y ofrece "Generar más preguntas".

### Backend básico (FastAPI)
- `GET /skills`: catálogo de ejemplo (skills, niveles y roles; incluye los roles guardados).
- `POST /roles`: guarda un rol con la configuración de cada recuadro (en memoria).
- `POST /generate`: arma el prompt agrupado por skill, llama al LLM (`POST /ask` de la PoC)
  y devuelve borradores en JSON.
- `POST /regenerate`: regenera un borrador, con feedback opcional.
- `POST /publish`: guarda las preguntas publicadas (una sola versión) con la marca de
  disponibilidad para expertos.
- `GET /items`, `GET /items/{id}`, `POST /items/{id}/revision`: lista, detalle (con la descripción
  de la skill y del nivel) y decisión del revisor.
- `MOCK=1`: borradores falsos sin llamar al LLM. `SEMILLA=0`: no carga las preguntas ficticias.
- Archivos subidos: se leen como texto (hasta 200 KB). Todo en memoria, sin BD.

### Cómo levantarlo
    bash poc/llm/run.sh                          # LLM, puerto 8002 (omitir con MOCK=1)
    bash poc/prototipo/backend/run.sh            # FastAPI, puerto 8003
    bash poc/prototipo/frontend/run.sh           # autor, puerto 5180
    bash poc/prototipo/revisor/run.sh            # revisor, puerto 5181

### Catálogo de ejemplo (a validar contra SFIA oficial)
PROG Programación/desarrollo de software; SWDN Diseño de software; SINT Integración
y construcción de sistemas; TEST Pruebas; REQM Definición y gestión de requisitos;
ARCH Arquitectura de soluciones; DBDS Diseño de datos; SCTY Seguridad de la información;
RELM Despliegue y liberación; CFMG Gestión de configuración.

## Interacción 2: Revisión de expertos (frontend separado, puerto 5181)
Objetivo: el revisor valida las preguntas que el autor publicó a disposición de expertos.
- **Lista:** preguntas publicadas con la casilla marcada, con pestañas Pendientes, Aprobadas,
  Rechazadas y Todas (con contador). Cada fila muestra skill, nivel, tipo, dificultad, tiempo,
  extracto del enunciado y estado.
- **Página de la pregunta** (`#/pregunta/<id>`): dificultad, tiempo estimado y tipo; descripción
  de la skill y del nivel de responsabilidad (desplegables); enunciado, rúbrica y criterios.
- **Decisión** (solo en la página de la pregunta): Aprobar, o Rechazar con motivo obligatorio.
  Es definitiva, y el motivo queda visible en la pregunta.
- Las preguntas de uso privado no aparecen. No hay login ni identidad del revisor.
- Descripciones de skills y niveles: redactadas para el prototipo, no son el texto oficial de SFIA.

## Interacciones siguientes
Por definir.
