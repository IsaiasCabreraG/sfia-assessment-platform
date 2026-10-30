"""Elige quién responde a `POST /ask` según `LLM_PROVIDER`: la CLI de Claude (`cli`) o la API de Groq (`groq`)."""
from shared.config import env
from shared.errors import BadGateway

from llm.cli import run_cli
from llm.groq import run_groq

PROVEEDORES = {"cli": run_cli, "groq": run_groq}


def generate(prompt: str) -> str:
    """Envía el prompt al proveedor configurado y devuelve el texto de su respuesta."""
    nombre = env("LLM_PROVIDER", "cli").strip().lower()
    if nombre not in PROVEEDORES:
        raise BadGateway(f"LLM_PROVIDER desconocido: {nombre!r} (válidos: {', '.join(PROVEEDORES)})")
    return PROVEEDORES[nombre](prompt)
