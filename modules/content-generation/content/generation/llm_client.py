"""Cliente HTTP del módulo llm (`POST /ask`)."""
import httpx

from shared.config import env
from shared.errors import BadGateway


class TextoIA(str):
    """Texto de la respuesta de la IA con los datos de la llamada en `meta` (proveedor, modelo, duración, tokens y parámetros)."""
    meta: dict = {}


def ask_llm(prompt: str, authorization: str) -> TextoIA:
    """Envía el prompt al módulo llm reenviando el JWT del usuario. Devuelve el texto de la respuesta (un `str`)."""
    try:
        r = httpx.post(
            f"{env('LLM_URL', 'http://localhost:8003')}/ask",
            json={"prompt": prompt},
            headers={"Authorization": authorization},
            timeout=float(env("LLM_TIMEOUT_SECONDS", "300")) + 10,
        )
    except httpx.HTTPError as e:
        raise BadGateway(f"No se pudo contactar al módulo llm: {e.__class__.__name__}")
    if r.status_code != 200:
        raise BadGateway(f"El módulo llm respondió {r.status_code}: {r.text[:200]}")
    datos = r.json()
    texto = TextoIA(datos["answer"])
    texto.meta = {k: datos.get(k, "--") for k in ("provider", "model", "duration_ms", "usage", "parameters")}
    return texto
