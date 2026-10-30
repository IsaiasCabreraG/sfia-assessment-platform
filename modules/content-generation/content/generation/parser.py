"""Extrae el JSON de la respuesta de texto de la IA."""
import json
import re


def extract_json(text: str) -> dict:
    """Devuelve el objeto JSON de `text`, tolerando bloques ```json y texto antes o después.

    Lanza ValueError si no hay un objeto JSON válido.
    """
    limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    inicio, fin = limpio.find("{"), limpio.rfind("}")
    if inicio == -1 or fin <= inicio:
        raise ValueError("la respuesta de la IA no contiene un objeto JSON")
    try:
        data = json.loads(limpio[inicio : fin + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON inválido: {e}")
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError('el JSON debe tener la forma {"items": [...]}')
    return data
