"""Elige quién responde a `POST /ask` según `LLM_PROVIDER`: la CLI de Claude (`cli`) o la API de Groq (`groq`)."""
import time

from shared.config import env
from shared.errors import BadGateway

from llm.cli import run_cli
from llm.groq import run_groq
from llm.respuesta import Respuesta

PROVEEDORES = {"cli": run_cli, "groq": run_groq}


def generate(prompt: str) -> Respuesta:
    """Envía el prompt al proveedor configurado y devuelve su respuesta: el texto, el modelo, los tokens, los
    parámetros y la duración. Cada proveedor informa lo que puede; el resto queda en «--»."""
    nombre = env("LLM_PROVIDER", "cli").strip().lower()
    if nombre not in PROVEEDORES:
        raise BadGateway(f"LLM_PROVIDER desconocido: {nombre!r} (válidos: {', '.join(PROVEEDORES)})")
    inicio = time.monotonic()
    respuesta = PROVEEDORES[nombre](prompt)
    respuesta.proveedor = nombre
    respuesta.duracion_ms = int((time.monotonic() - inicio) * 1000)
    return respuesta
