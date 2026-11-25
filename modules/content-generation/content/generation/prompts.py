"""Arma los prompts que se envían a la IA para generar ítems (HU-04 y HU-06).

El texto vive en `prompt.json` (plantilla, frases opcionales, reglas y forma del JSON por tipo);
este módulo solo lo carga y reemplaza los marcadores por los datos de cada pedido.
"""
import json
from pathlib import Path

from content.generation.rubric import CRITERIOS_FIJOS, CRITERIOS_IA, PESO_CRITERIO
from content.types import OPEN_TYPES

RUTA_PLANTILLA = Path(__file__).with_name("prompt.json")
LETRAS = "ABCD"


def _cargar() -> dict:
    """Lee prompt.json y comprueba que tenga todo lo que `build_prompt` necesita."""
    plantilla = json.loads(RUTA_PLANTILLA.read_text(encoding="utf-8"))
    for clave in ("plantilla", "opcionales", "reintento", "reglas_por_tipo", "forma_json_por_tipo",
                  "plantilla_referencia", "forma_json_referencia"):
        if clave not in plantilla:
            raise RuntimeError(f"prompt.json: falta '{clave}'")
    if set(plantilla["reglas_por_tipo"]) != set(plantilla["forma_json_por_tipo"]):
        raise RuntimeError("prompt.json: reglas_por_tipo y forma_json_por_tipo deben tener los mismos tipos")
    return plantilla


PROMPT = _cargar()


def _rubrica_ejemplo() -> list[dict]:
    """Rúbrica de ejemplo del JSON: solo los criterios propios del problema (los fijos los agrega el servidor)."""
    return [{"name": f"Criterio propio del problema {n}", "weight": PESO_CRITERIO,
             "levels": [{"score": s, "descriptor": f"Qué debe cumplir la respuesta para obtener {s}"} for s in range(4)]}
            for n in range(1, CRITERIOS_IA + 1)]


def _texto_criterios_fijos(item_type: str) -> str:
    """Los criterios fijos del tipo con sus descriptores, para que la IA no los repita."""
    return "\n".join(
        f"- {c['name']}: " + "; ".join(f"{n['score']} = {n['descriptor']}" for n in c["levels"])
        for c in CRITERIOS_FIJOS[item_type])


def _forma_json(item_type: str, sin_referencia: bool) -> str:
    forma = dict(PROMPT["forma_json_por_tipo"][item_type])
    if item_type in OPEN_TYPES:
        forma["rubric"] = _rubrica_ejemplo()
        if sin_referencia:
            forma.pop("reference_answer", None)
    return json.dumps({"items": [forma]}, ensure_ascii=False, indent=2)


def _texto_objetivos(item_type: str, objetivos: list | None) -> str | None:
    """Qué respuesta correcta debe tener cada ítem (la elige el servidor antes de pedirlo, HU-04-2 y HU-04-7)."""
    if not objetivos:
        return None
    if item_type == "single_choice":
        return "posición de la opción correcta de cada ítem: " + "; ".join(
            f"ítem {i} → {LETRAS[o - 1]}" for i, o in enumerate(objetivos, start=1))
    if item_type == "true_false":
        return "respuesta correcta de cada ítem: " + "; ".join(
            f"ítem {i} → {'verdadero' if o else 'falso'}" for i, o in enumerate(objetivos, start=1))
    return None


def build_prompt(*, skill: dict, level: int, level_title: str, item_type: str, count: int,
                 estimated_minutes: int, context: str | None, previous_error: str | None = None,
                 feedback: str | None = None, previous_statement: str | None = None,
                 objetivos: list | None = None, sin_referencia: bool = False) -> str:
    """Prompt de generación. `previous_error` se agrega en el reintento tras una respuesta inválida;
    `feedback` y `previous_statement` al regenerar un borrador; `objetivos` fija la respuesta correcta de cada
    ítem (alternativa única y verdadero o falso); `sin_referencia` pide un tipo abierto sin su respuesta de
    referencia (primer paso de dos)."""
    descripcion = (skill.get("description") or "").strip()
    if not descripcion:
        raise ValueError(f"La skill {skill['code']} no tiene descripción en el catálogo")
    es_abierto = item_type in OPEN_TYPES
    datos = {
        "cantidad": count, "tipo": item_type, "skill_codigo": skill["code"], "skill_nombre": skill["name"],
        "skill_descripcion": descripcion, "nivel": level, "nivel_titulo": level_title, "minutos": estimated_minutes,
        "contexto": context, "enunciado_anterior": previous_statement, "feedback": feedback,
        "objetivos": _texto_objetivos(item_type, objetivos),
        "criterios_fijos": _texto_criterios_fijos(item_type) if es_abierto else None,
        "sin_referencia": es_abierto and sin_referencia,
        "reglas": PROMPT["reglas_por_tipo"][item_type],
        "forma_json": _forma_json(item_type, sin_referencia),
    }
    # Cada frase opcional depende de un dato; si el dato no existe, la línea no aparece.
    dato_de = {"contexto": "contexto", "regenerar": "enunciado_anterior", "feedback": "feedback",
               "objetivos": "objetivos", "criterios": "criterios_fijos", "sin_referencia": "sin_referencia"}
    lineas = []
    for linea in PROMPT["plantilla"]:
        if linea.startswith("{?"):
            nombre = linea[2:-1]
            if datos[dato_de[nombre]]:
                lineas.append(PROMPT["opcionales"][nombre].format(**datos))
        else:
            lineas.append(linea.format(**datos))
    if previous_error:
        lineas += ["", PROMPT["reintento"].format(errores=previous_error)]
    return "\n".join(lineas)


def build_reference_prompt(*, skill: dict, level: int, level_title: str, item_type: str, items: list[dict],
                           previous_error: str | None = None) -> str:
    """Segundo paso de los tipos abiertos: la IA escribe la respuesta de referencia de cada ítem a partir de
    su enunciado y su rúbrica (HU-04-4)."""
    sin_referencia = [{k: v for k, v in item.items() if k != "reference_answer"} for item in items]
    datos = {
        "cantidad": len(items), "tipo": item_type, "skill_codigo": skill["code"], "skill_nombre": skill["name"],
        "nivel": level, "nivel_titulo": level_title,
        "items_json": json.dumps(sin_referencia, ensure_ascii=False, indent=2),
        "forma_json": json.dumps({"items": [PROMPT["forma_json_referencia"]]}, ensure_ascii=False, indent=2),
    }
    lineas = [linea.format(**datos) for linea in PROMPT["plantilla_referencia"]]
    if previous_error:
        lineas += ["", PROMPT["reintento"].format(errores=previous_error)]
    return "\n".join(lineas)
