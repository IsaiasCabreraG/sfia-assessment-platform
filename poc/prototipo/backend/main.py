"""Backend del prototipo (FastAPI, puerto 8003).

    GET  /skills                      catálogo de ejemplo (skills, niveles, roles)
    POST /roles                       guarda un rol (en memoria)
    POST /generate                    arma el prompt y llama al LLM de la PoC (POST /ask)
    POST /regenerate                  regenera un borrador, con feedback opcional
    POST /publish                     publica las preguntas del autor (una sola versión)
    GET  /items, /items/{id}          preguntas publicadas para expertos
    POST /items/{id}/revision         decisión del revisor (aprobada | rechazada)

MOCK=1 devuelve borradores falsos sin llamar al LLM. SEMILLA=0 no carga las preguntas ficticias.
Todo vive en memoria: se pierde al reiniciar.
"""
import json
import os
import platform
from datetime import datetime, timezone
from importlib.metadata import version

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

LLM_URL = os.getenv("LLM_URL", "http://localhost:8002")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT_SECONDS", "180"))
MOCK = os.getenv("MOCK") == "1"

app = FastAPI(title="Prototipo - Backend")

NIVELES = {
    1: "Seguir", 2: "Asistir", 3: "Aplicar", 4: "Habilitar",
    5: "Asegurar/Asesorar", 6: "Iniciar/Influir", 7: "Definir estrategia/Inspirar",
}

# Descripciones redactadas para el prototipo; no son el texto oficial de SFIA.
NIVELES_DESC = {
    1: "Trabaja bajo supervisión cercana, sigue instrucciones y aprende; tareas rutinarias.",
    2: "Apoya a otros, trabaja con supervisión moderada y gestiona tareas propias acotadas.",
    3: "Trabaja con autonomía en tareas variadas, elige métodos y resuelve problemas habituales.",
    4: "Trabaja con autonomía sustancial, influye en el equipo y asume tareas complejas planificándolas.",
    5: "Es referente técnico: asegura la calidad, asesora y responde por los resultados de un área.",
    6: "Influye en la organización, define enfoques y asume responsabilidad sobre áreas amplias.",
    7: "Fija la dirección estratégica y lidera a nivel de la organización o del sector.",
}

SKILLS = [
    {"codigo": "PROG", "nombre": "Programación / desarrollo de software", "descripcion": "Diseñar, escribir, probar y documentar código de software siguiendo los estándares y herramientas del equipo."},
    {"codigo": "SWDN", "nombre": "Diseño de software", "descripcion": "Especificar y diseñar la estructura y el comportamiento de componentes de software que cumplen los requisitos."},
    {"codigo": "SINT", "nombre": "Integración y construcción de sistemas", "descripcion": "Integrar componentes en sistemas completos y automatizar su construcción y verificación."},
    {"codigo": "TEST", "nombre": "Pruebas", "descripcion": "Planificar y ejecutar pruebas para verificar que un sistema cumple sus requisitos y detectar defectos."},
    {"codigo": "REQM", "nombre": "Definición y gestión de requisitos", "descripcion": "Obtener, analizar, documentar y gestionar los requisitos de un sistema y sus cambios."},
    {"codigo": "ARCH", "nombre": "Arquitectura de soluciones", "descripcion": "Definir la arquitectura de una solución equilibrando necesidades de negocio, calidad técnica y restricciones."},
    {"codigo": "DBDS", "nombre": "Diseño de datos", "descripcion": "Modelar y diseñar estructuras de datos y bases de datos que cubran las necesidades de información."},
    {"codigo": "SCTY", "nombre": "Seguridad de la información", "descripcion": "Proteger información y sistemas aplicando controles, evaluando riesgos y respondiendo a incidentes."},
    {"codigo": "RELM", "nombre": "Despliegue y liberación", "descripcion": "Planificar y controlar el despliegue de versiones de software en los entornos de producción."},
    {"codigo": "CFMG", "nombre": "Gestión de configuración", "descripcion": "Mantener el control de los elementos de configuración y de sus cambios durante el ciclo de vida."},
]

ROLES = [
    {"id": "swe3", "nombre": "Ingeniero de software (nivel 3)",
     "skills": [{"codigo": "PROG", "nivel": 3}, {"codigo": "SWDN", "nivel": 3}, {"codigo": "TEST", "nivel": 3}]},
    {"id": "swe4", "nombre": "Ingeniero de software senior (nivel 4)",
     "skills": [{"codigo": "PROG", "nivel": 4}, {"codigo": "SWDN", "nivel": 4}, {"codigo": "TEST", "nivel": 4}, {"codigo": "DBDS", "nivel": 4}]},
    {"id": "arq5", "nombre": "Arquitecto de soluciones (nivel 5)",
     "skills": [{"codigo": "ARCH", "nivel": 5}, {"codigo": "SWDN", "nivel": 5}, {"codigo": "SCTY", "nivel": 4}, {"codigo": "REQM", "nivel": 4}]},
]

TIPOS = {
    "pregunta": "pregunta de alternativas (opción múltiple: 4 alternativas A-D incluidas en el enunciado, una sola correcta indicada en los criterios de aceptación)",
    "coding": "coding challenge",
    "system_design": "system design / arquitectura",
    "debugging": "debugging / code review",
    "proyecto": "proyecto práctico (mini-proyecto take-home)",
}


# ---------- Modelos de entrada (los campos extra que manda el frontend se ignoran) ----------
class TipoPedido(BaseModel):
    tipo: str
    cantidad: int


class Bloque(BaseModel):
    codigo: str
    nombre: str
    nivel: int
    tipos: list[TipoPedido]
    dificultad: str
    tiempo_min: int


class Archivo(BaseModel):
    nombre: str
    contenido: str


class Texto(BaseModel):
    texto: str = ""
    archivos: list[Archivo] = []


class Formulario(BaseModel):
    bloques: list[Bloque]
    contexto: Texto = Texto()
    cargo: Texto = Texto()
    stack: list[str] = []
    referencias: list[Archivo] = []
    restricciones: str = ""


class Borrador(BaseModel):
    id: str = ""
    enunciado: str
    skill: str
    nivel: int
    tipo: str
    dificultad: str = "media"
    rubrica: list[str] = []
    criterios_aceptacion: list[str] = []
    tiempo_min: int = 20
    estado: str = "draft"


class RolNuevo(BaseModel):
    nombre: str = ""
    skills: list[dict] = []


class RegenerarPedido(BaseModel):
    formulario: Formulario
    borrador: Borrador
    feedback: str = ""


class PublicarPedido(BaseModel):
    borradores: list[Borrador] = []
    disponible_expertos: bool = False


class DecisionPedido(BaseModel):
    decision: str
    motivo: str = ""


# ---------- Prompt y LLM ----------
def bloque_texto(titulo: str, texto: str, archivos: list[Archivo] | None = None) -> str:
    partes = []
    if texto.strip():
        partes.append(texto.strip())
    for a in archivos or []:
        partes.append(f"[Archivo: {a.nombre}]\n{a.contenido}")
    return f"## {titulo}\n" + "\n\n".join(partes) + "\n" if partes else ""


def armar_prompt(f: Formulario, extra: str = "") -> str:
    pedidos = []
    for b in f.bloques:
        tipos = "\n".join(f'  - {t.cantidad} de tipo "{t.tipo}": {TIPOS.get(t.tipo, t.tipo)}' for t in b.tipos)
        pedidos.append(
            f"### {b.codigo} {b.nombre}, nivel {b.nivel} ({NIVELES.get(b.nivel, '')})\n"
            f"Dificultad: {b.dificultad}. Tiempo estimado por ítem: {b.tiempo_min} minutos.\n{tipos}"
        )
    pedidos_txt = "\n\n".join(pedidos)
    stack = f"## Stack tecnológico\n{', '.join(f.stack)}\n" if f.stack else ""
    return f"""Eres un experto en evaluación técnica de ingeniería de software basada en el marco SFIA.
Genera borradores de ítems de evaluación. Un experto los validará después.

## Ítems a generar, por skill SFIA
Cada ítem evalúa UNA skill y debe corresponder a su nivel de responsabilidad (1-7), su dificultad y su tiempo.

{pedidos_txt}

{bloque_texto("Contexto (empresa, cargo o curso)", f.contexto.texto, f.contexto.archivos)}
{bloque_texto("Descripción del cargo", f.cargo.texto, f.cargo.archivos)}
{stack}
{bloque_texto("Documentos de referencia (úsalos como fuente, no inventes)", "", f.referencias)}
{bloque_texto("Restricciones e instrucciones extra", f.restricciones)}
{extra}
## Formato de salida
Responde SOLO con un arreglo JSON válido, sin texto antes ni después ni bloques de código. Cada elemento:
{{"enunciado": string, "skill": "CODIGO", "nivel": 1-7, "tipo": "pregunta|coding|system_design|debugging|proyecto",
 "dificultad": "basica|media|alta", "rubrica": [string con "Criterio: descripción"], "criterios_aceptacion": [string], "tiempo_min": number}}
Idioma: español, salvo que las restricciones indiquen otro."""


async def preguntar_llm(prompt: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as c:
            r = await c.post(f"{LLM_URL}/ask", json={"prompt": prompt})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"No se pudo contactar al LLM en {LLM_URL}: {e.__class__.__name__}")
    if r.status_code != 200:
        raise HTTPException(502, f"LLM respondió {r.status_code}: {r.text[:200]}")
    return r.json()["answer"]


def extraer_json(texto: str) -> list[dict]:
    ini, fin = texto.find("["), texto.rfind("]")
    if ini < 0 or fin < 0:
        raise HTTPException(502, "El LLM no devolvió un arreglo JSON")
    try:
        datos = json.loads(texto[ini : fin + 1])
    except json.JSONDecodeError:
        raise HTTPException(502, "El LLM devolvió un JSON inválido")
    if not isinstance(datos, list) or not all(isinstance(d, dict) for d in datos):
        raise HTTPException(502, "El LLM no devolvió una lista de ítems")
    return datos


_contador_borradores = 0


def a_borrador(it: dict) -> dict:
    global _contador_borradores
    _contador_borradores += 1
    return {
        "id": f"b{_contador_borradores}",
        "enunciado": str(it.get("enunciado", "")),
        "skill": str(it.get("skill", "")),
        "nivel": int(it.get("nivel") or 1),
        "tipo": str(it.get("tipo", "")),
        "dificultad": str(it.get("dificultad") or "media"),
        "rubrica": [str(x) for x in it.get("rubrica", [])] if isinstance(it.get("rubrica"), list) else [],
        "criterios_aceptacion": [str(x) for x in it.get("criterios_aceptacion", [])] if isinstance(it.get("criterios_aceptacion"), list) else [],
        "tiempo_min": int(it.get("tiempo_min") or 20),
        "estado": "draft",
    }


def mock(f: Formulario) -> list[dict]:
    items = []
    for b in f.bloques:
        for t in b.tipos:
            for _ in range(t.cantidad):
                items.append({
                    "enunciado": f"[MOCK] Ejercicio de tipo {t.tipo} sobre {b.nombre} (nivel {b.nivel}). Contexto: {f.contexto.texto[:80] or 'sin contexto'}.",
                    "skill": b.codigo, "nivel": b.nivel, "tipo": t.tipo, "dificultad": b.dificultad,
                    "rubrica": ["Corrección: la solución cumple lo pedido", "Claridad: explica sus decisiones"],
                    "criterios_aceptacion": ["Resuelve el caso base", "Justifica la elección técnica"],
                    "tiempo_min": b.tiempo_min,
                })
    return items


# ---------- Ítems publicados y semillas ----------
ITEMS: list[dict] = []
_contador_items = 0


def siguiente_id_item() -> str:
    global _contador_items
    _contador_items += 1
    return f"q{_contador_items}"


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def detalle(it: dict) -> dict:
    skill = next((s for s in SKILLS if s["codigo"] == it["skill"]), None)
    return {
        **it,
        "skill_info": {"codigo": it["skill"], "nombre": skill["nombre"] if skill else it["skill"], "descripcion": skill["descripcion"] if skill else ""},
        "nivel_info": {"nivel": it["nivel"], "nombre": NIVELES.get(it["nivel"]), "descripcion": NIVELES_DESC.get(it["nivel"], "")},
    }


# Preguntas ficticias ya publicadas, repartidas entre pendientes, aprobadas y rechazadas, para probar
# la vista del revisor sin generar nada. SEMILLA=0 en el .env las desactiva.
SEMILLA = [
    {"skill": "PROG", "nivel": 3, "tipo": "pregunta", "dificultad": "media", "tiempo_min": 5,
     "enunciado": "¿Qué imprime este código en Python?\n\ndef agregar(x, lista=[]):\n    lista.append(x)\n    return lista\n\nprint(agregar(1))\nprint(agregar(2))\n\nA) [1] y [2]\nB) [1] y [1, 2]\nC) Lanza un error en la segunda llamada\nD) [1, 2] y [1, 2]",
     "rubrica": ["Comprensión: identifica que el valor por defecto mutable se crea una sola vez", "Precisión: elige la alternativa sin adivinar"],
     "criterios_aceptacion": ["Respuesta correcta: B", "Las alternativas incorrectas son plausibles"]},
    {"skill": "PROG", "nivel": 4, "tipo": "coding", "dificultad": "alta", "tiempo_min": 30,
     "enunciado": "Implementa un limitador de tasa de ventana deslizante: `permitir(clave: str, ahora: float) -> bool` debe aceptar como máximo N solicitudes por clave en los últimos T segundos. Explica la complejidad en tiempo y memoria y cómo lo harías seguro frente a concurrencia.",
     "rubrica": ["Corrección: respeta el límite en los bordes de la ventana", "Eficiencia: descarta marcas de tiempo vencidas sin recorrer todo", "Concurrencia: propone un mecanismo de sincronización razonable"],
     "criterios_aceptacion": ["Pasa casos con ráfagas en el borde de la ventana", "Complejidad amortizada O(1) por llamada", "Justifica la estructura de datos elegida"]},
    {"skill": "ARCH", "nivel": 5, "tipo": "system_design", "dificultad": "alta", "tiempo_min": 45,
     "enunciado": "Una fintech con 2 millones de usuarios necesita un servicio de notificaciones (correo, SMS y push) con entrega al menos una vez, plantillas y preferencias por usuario. Diseña la arquitectura: componentes, flujo de un mensaje, manejo de fallos de proveedores externos y cómo escalarías en picos de 10x.",
     "rubrica": ["Arquitectura: separa ingestión, cola, envío y proveedores", "Resiliencia: reintentos con retroceso, idempotencia y cola de mensajes fallidos", "Escalabilidad: justifica particionado y límites por proveedor", "Comunicación: expone los supuestos y compromisos"],
     "criterios_aceptacion": ["Incluye un diagrama o descripción de componentes", "Aborda la entrega duplicada", "Identifica al menos dos cuellos de botella"]},
    {"skill": "TEST", "nivel": 3, "tipo": "debugging", "dificultad": "media", "tiempo_min": 20,
     "enunciado": "Este test falla de forma intermitente en CI pero pasa en tu máquina:\n\ndef test_reporte_del_dia():\n    reporte = generar_reporte()\n    assert reporte.fecha == date.today()\n    assert len(reporte.filas) == contar_pedidos_de_hoy()\n\nIdentifica las causas probables de la intermitencia y propón cómo volver el test determinista.",
     "rubrica": ["Diagnóstico: detecta la dependencia del reloj y de datos compartidos", "Solución: propone fijar el tiempo y aislar los datos", "Criterio: explica por qué el fallo aparece solo en CI"],
     "criterios_aceptacion": ["Menciona cruce de medianoche o zonas horarias", "Propone un reloj inyectable o congelado", "Propone datos propios del test"]},
    {"skill": "DBDS", "nivel": 4, "tipo": "pregunta", "dificultad": "media", "tiempo_min": 6,
     "enunciado": "Una consulta filtra con `WHERE estado = 'activo' AND creado_en > ?` y ordena por `creado_en`. La tabla tiene 50 millones de filas y casi todas están 'activo'. ¿Qué índice es más adecuado?\n\nA) Índice solo en `estado`\nB) Índice compuesto (`creado_en`)\nC) Índice compuesto (`estado`, `creado_en`)\nD) Ningún índice, es mejor un escaneo completo",
     "rubrica": ["Razonamiento: reconoce la baja selectividad de `estado`", "Precisión: elige la opción que además evita el ordenamiento"],
     "criterios_aceptacion": ["Respuesta aceptada: B o C, con la justificación correspondiente", "La alternativa A es el distractor principal"],
     "revision": "aprobada"},
    {"skill": "SCTY", "nivel": 3, "tipo": "pregunta", "dificultad": "basica", "tiempo_min": 3,
     "enunciado": "¿Qué es la seguridad de la información?\n\nA) Proteger los datos\nB) Usar contraseñas\nC) Tener un antivirus\nD) Todas las anteriores",
     "rubrica": ["Conocimiento: define el concepto"],
     "criterios_aceptacion": ["Respuesta correcta: D"],
     "revision": "rechazada", "motivo": "Demasiado genérica para el nivel 3: mide memoria de una definición, no aplicación. Además 'todas las anteriores' es un patrón fácil de adivinar."},
    {"skill": "REQM", "nivel": 4, "tipo": "proyecto", "dificultad": "alta", "tiempo_min": 90,
     "enunciado": "Un hospital pide 'un sistema para agendar citas más rápido'. Entrevista (por escrito) a un interesado ficticio con 8 preguntas, luego redacta una especificación breve con requisitos funcionales y no funcionales priorizados, y tres criterios de aceptación medibles.",
     "rubrica": ["Elicitación: las preguntas descubren necesidades y no solo confirman supuestos", "Calidad: los requisitos son verificables y no ambiguos", "Priorización: usa un criterio explícito (p. ej. MoSCoW)"],
     "criterios_aceptacion": ["Incluye al menos 3 requisitos no funcionales", "Los criterios de aceptación tienen una métrica", "Identifica un riesgo o supuesto"]},
]


def cargar_semilla() -> None:
    for q in SEMILLA:
        datos = {k: v for k, v in q.items() if k not in ("revision", "motivo")}
        ITEMS.append({
            "id": siguiente_id_item(), **datos, "estado": "publicado", "disponible_expertos": True,
            "revision": q.get("revision", "pendiente"), "motivo_rechazo": q.get("motivo"), "publicado_en": ahora(),
        })


if os.getenv("SEMILLA") != "0":
    cargar_semilla()

_contador_roles = 0


# ---------- Endpoints ----------
@app.get("/health")
def health():
    return {
        "modulo": "prototipo-backend",
        "variante": "fastapi",
        "versiones": {"python": platform.python_version(), "fastapi": version("fastapi")},
        "mock": MOCK,
        "llm_url": LLM_URL,
    }


@app.get("/skills")
def skills():
    return {"skills": SKILLS, "roles": ROLES, "niveles": NIVELES}


@app.post("/roles", status_code=201)
def guardar_rol(body: RolNuevo):
    global _contador_roles
    if not body.nombre.strip():
        raise HTTPException(422, "El rol necesita un nombre")
    if not body.skills:
        raise HTTPException(422, "El rol necesita al menos una skill")
    _contador_roles += 1
    rol = {"id": f"propio{_contador_roles}", "nombre": body.nombre.strip(), "propio": True, "skills": body.skills}
    ROLES.append(rol)
    return {"rol": rol}


@app.post("/generate")
async def generate(f: Formulario):
    crudo = mock(f) if MOCK else extraer_json(await preguntar_llm(armar_prompt(f)))
    return {"borradores": [a_borrador(it) for it in crudo]}


@app.post("/regenerate")
async def regenerate(req: RegenerarPedido):
    f, previo = req.formulario, req.borrador
    if not f.bloques:
        raise HTTPException(422, "El formulario no tiene skills")
    base = next((b for b in f.bloques if b.codigo == previo.skill and b.nivel == previo.nivel), f.bloques[0])
    bloque = base.model_copy(update={
        "codigo": previo.skill, "nivel": previo.nivel, "dificultad": previo.dificultad,
        "tiempo_min": previo.tiempo_min, "tipos": [TipoPedido(tipo=previo.tipo, cantidad=1)],
    })
    g = f.model_copy(update={"bloques": [bloque]})
    extra = f"## Nota\nYa existe este ítem y no te gustó; propón uno DISTINTO:\n{previo.enunciado}\n"
    if req.feedback.strip():
        extra += f"Feedback del autor sobre ese ítem (aplícalo):\n{req.feedback.strip()}\n"
    crudo = mock(g) if MOCK else extraer_json(await preguntar_llm(armar_prompt(g, extra)))
    if not crudo:
        raise HTTPException(502, "El LLM no devolvió ningún ítem")
    return {"borrador": a_borrador(crudo[0])}


@app.post("/publish", status_code=201)
def publish(req: PublicarPedido):
    if not req.borradores:
        raise HTTPException(422, "No hay preguntas para publicar")
    for b in req.borradores:
        ITEMS.append({
            **b.model_dump(), "id": siguiente_id_item(), "estado": "publicado",
            "disponible_expertos": req.disponible_expertos,
            "revision": "pendiente" if req.disponible_expertos else None,
            "motivo_rechazo": None, "publicado_en": ahora(),
        })
    return {"publicados": len(req.borradores), "disponible_expertos": req.disponible_expertos}


def buscar_item(item_id: str) -> dict:
    it = next((x for x in ITEMS if x["id"] == item_id and x["disponible_expertos"]), None)
    if not it:
        raise HTTPException(404, "Pregunta no encontrada")
    return it


@app.get("/items")
def listar_items(revision: str | None = None):
    return {"items": [it for it in ITEMS if it["disponible_expertos"] and (not revision or it["revision"] == revision)]}


@app.get("/items/{item_id}")
def obtener_item(item_id: str):
    return {"item": detalle(buscar_item(item_id))}


@app.post("/items/{item_id}/revision")
def revisar_item(item_id: str, body: DecisionPedido):
    it = buscar_item(item_id)
    if it["revision"] != "pendiente":
        raise HTTPException(409, "Esta pregunta ya fue revisada")
    if body.decision not in ("aprobada", "rechazada"):
        raise HTTPException(422, "Decisión inválida")
    if body.decision == "rechazada" and not body.motivo.strip():
        raise HTTPException(422, "El rechazo necesita un motivo")
    it["revision"] = body.decision
    it["motivo_rechazo"] = body.motivo.strip() if body.decision == "rechazada" else None
    it["revisado_en"] = ahora()
    return {"item": detalle(it)}
