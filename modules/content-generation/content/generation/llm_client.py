"""Cliente HTTP del módulo llm (`POST /ask`)."""
import httpx

from shared.config import env
from shared.errors import BadGateway


def ask_llm(prompt: str, authorization: str) -> str:
    """Envía el prompt al módulo llm reenviando el JWT del usuario. Devuelve el texto de la respuesta."""
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
    return r.json()["answer"]
