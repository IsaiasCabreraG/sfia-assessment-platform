"""Proveedor Groq: llama a su API (compatible con OpenAI) y devuelve el texto de la respuesta.

Documentación: https://console.groq.com/docs/openai. El plan gratuito limita pedidos y tokens por minuto y
por día (se ven en https://console.groq.com/settings/limits); al pasarse, Groq responde 429 con la
cabecera `retry-after`, que aquí se respeta con unos pocos reintentos.
"""
import time

import httpx

from shared.config import env
from shared.errors import BadGateway

MODELO_POR_DEFECTO = "openai/gpt-oss-120b"
MAX_REINTENTOS_429 = 2   # veces que se espera y se vuelve a intentar tras un 429
ESPERA_MAXIMA = 30       # segundos máximos que se espera entre reintentos


def _mensaje_de_error(r: httpx.Response) -> str:
    """Texto del error que devuelve Groq ({"error": {"message": ...}}) o, si no hay, el cuerpo en bruto."""
    try:
        return str(r.json()["error"]["message"])
    except Exception:
        return r.text[:200]


def _espera(r: httpx.Response) -> float:
    """Segundos a esperar según `retry-after` (entre 1 y ESPERA_MAXIMA); 5 si Groq no lo indica."""
    try:
        return min(max(float(r.headers["retry-after"]), 1.0), ESPERA_MAXIMA)
    except (KeyError, ValueError):
        return 5.0


def run_groq(prompt: str) -> str:
    """Envía `prompt` al modelo de `LLM_MODEL` y devuelve su respuesta.

    Errores (todos `BadGateway`, con un mensaje que explica qué hacer): falta la clave, clave rechazada,
    límite de uso agotado, respuesta cortada por el límite de tokens, tiempo agotado o servidor caído.
    """
    clave = env("GROQ_API_KEY", "")
    if not clave:
        raise BadGateway("Falta GROQ_API_KEY en el .env del módulo llm (se crea en console.groq.com › API Keys)")
    base = env("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    cuerpo = {
        "model": env("LLM_MODEL", MODELO_POR_DEFECTO),
        "messages": [{"role": "user", "content": prompt}],
        "max_completion_tokens": int(env("LLM_MAX_TOKENS", "4096")),
        "temperature": float(env("LLM_TEMPERATURE", "0.6")),
    }
    if env("LLM_REASONING_EFFORT", ""):  # solo modelos de razonamiento (gpt-oss): "low" gasta menos tokens pensando
        cuerpo["reasoning_effort"] = env("LLM_REASONING_EFFORT")
    cabeceras = {"Authorization": f"Bearer {clave}", "Content-Type": "application/json", "User-Agent": "sfia-sprint1/1.0"}

    for intento in range(MAX_REINTENTOS_429 + 1):
        try:
            r = httpx.post(f"{base}/chat/completions", json=cuerpo, headers=cabeceras,
                           timeout=float(env("LLM_TIMEOUT_SECONDS", "300")))
        except httpx.TimeoutException:
            raise BadGateway("Groq excedió el tiempo límite")
        except httpx.HTTPError as e:
            raise BadGateway(f"No se pudo contactar a Groq: {e.__class__.__name__}")
        if r.status_code == 429 and intento < MAX_REINTENTOS_429:
            time.sleep(_espera(r))
            continue
        break

    if r.status_code == 401:
        raise BadGateway("Groq rechazó la clave: GROQ_API_KEY es inválida o fue revocada")
    if r.status_code == 429:
        raise BadGateway(f"Se alcanzó el límite de uso gratuito de Groq: {_mensaje_de_error(r)} "
                         f"(espera unos segundos o revisa console.groq.com/settings/limits)")
    if r.status_code == 404:
        raise BadGateway(f"Tu cuenta de Groq no tiene el modelo {cuerpo['model']!r} (o no existe). Los disponibles se ven con: "
                         f"bash tools/run_python.sh modules/llm-gateway/llm/probar.py --modelos  y se elige con LLM_MODEL en el .env")
    if r.status_code != 200:
        raise BadGateway(f"Groq respondió {r.status_code}: {_mensaje_de_error(r)}")

    opcion = r.json()["choices"][0]
    if opcion.get("finish_reason") == "length":
        raise BadGateway("La respuesta de la IA se cortó por el límite de tokens (LLM_MAX_TOKENS): "
                         "pide menos ítems por pedido o sube el límite")
    texto = (opcion.get("message") or {}).get("content")
    if not texto:
        raise BadGateway("Groq devolvió una respuesta vacía")
    return texto.strip()


def listar_modelos() -> list[dict]:
    """Modelos que la cuenta de Groq puede usar (`GET /models`). Sirve para elegir `LLM_MODEL`."""
    clave = env("GROQ_API_KEY", "")
    if not clave:
        raise BadGateway("Falta GROQ_API_KEY en el .env del módulo llm")
    try:
        r = httpx.get(env("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/") + "/models",
                      headers={"Authorization": f"Bearer {clave}", "User-Agent": "sfia-sprint1/1.0"}, timeout=30)
    except httpx.HTTPError as e:
        raise BadGateway(f"No se pudo contactar a Groq: {e.__class__.__name__}")
    if r.status_code != 200:
        raise BadGateway(f"Groq respondió {r.status_code}: {_mensaje_de_error(r)}")
    return sorted(r.json()["data"], key=lambda m: m["id"])
