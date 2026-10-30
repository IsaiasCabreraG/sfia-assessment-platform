"""Arma el prompt que se envía a la IA para generar ítems (HU-04 y HU-06).

El texto vive en `prompt.json` (plantilla, frases opcionales, reglas y forma del JSON por tipo);
este módulo solo lo carga y reemplaza los marcadores por los datos de cada pedido.
"""
import json
from pathlib import Path

RUTA_PLANTILLA = Path(__file__).with_name("prompt.json")


def _cargar() -> dict:
    """Lee prompt.json y comprueba que tenga todo lo que `build_prompt` necesita."""
    plantilla = json.loads(RUTA_PLANTILLA.read_text(encoding="utf-8"))
    for clave in ("plantilla", "opcionales", "reintento", "reglas_por_tipo", "forma_json_por_tipo"):
        if clave not in plantilla:
            raise RuntimeError(f"prompt.json: falta '{clave}'")
    if set(plantilla["reglas_por_tipo"]) != set(plantilla["forma_json_por_tipo"]):
        raise RuntimeError("prompt.json: reglas_por_tipo y forma_json_por_tipo deben tener los mismos tipos")
    return plantilla


PROMPT = _cargar()


def build_prompt(*, skill: dict, level: int, level_title: str, item_type: str, count: int,
                 estimated_minutes: int, context: str | None, previous_error: str | None = None,
                 feedback: str | None = None, previous_statement: str | None = None) -> str:
    """Prompt de generación. `previous_error` se agrega en el reintento tras una respuesta inválida;
    `feedback` y `previous_statement` al regenerar un borrador."""
    descripcion = (skill.get("description") or "").strip()
    if not descripcion:
        raise ValueError(f"La skill {skill['code']} no tiene descripción en el catálogo")
    datos = {
        "cantidad": count, "tipo": item_type, "skill_codigo": skill["code"], "skill_nombre": skill["name"],
        "skill_descripcion": descripcion, "nivel": level, "nivel_titulo": level_title, "minutos": estimated_minutes,
        "contexto": context, "enunciado_anterior": previous_statement, "feedback": feedback,
        "reglas": PROMPT["reglas_por_tipo"][item_type],
        "forma_json": json.dumps({"items": [PROMPT["forma_json_por_tipo"][item_type]]}, ensure_ascii=False, indent=2),
    }
    # Cada frase opcional depende de un dato; si el dato no existe, la línea no aparece.
    dato_de = {"contexto": "contexto", "regenerar": "enunciado_anterior", "feedback": "feedback"}
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
