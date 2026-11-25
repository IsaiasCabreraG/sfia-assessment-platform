"""Ejecuta la CLI del modelo de lenguaje como subproceso (por defecto `claude -p`)."""
import shlex
import subprocess
import tempfile

from shared.config import env
from shared.errors import BadGateway

from llm.respuesta import Respuesta


def run_cli(prompt: str) -> Respuesta:
    """Envía `prompt` por stdin a la CLI y devuelve su salida (la CLI no informa modelo, tokens ni parámetros: quedan en «--»).

    Sin shell (evita inyección de comandos), con timeout y desde una carpeta neutra: si la CLI se
    lanza dentro de un proyecto, hereda su CLAUDE.md y su memoria y contamina las respuestas.
    """
    command = shlex.split(env("LLM_CLI_COMMAND", "claude -p"))
    timeout = int(env("LLM_TIMEOUT_SECONDS", "300"))
    cwd = env("LLM_CLI_CWD", tempfile.gettempdir())
    try:
        result = subprocess.run(command, input=prompt, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    except subprocess.TimeoutExpired:
        raise BadGateway("La CLI del LLM excedió el tiempo límite")
    except FileNotFoundError:
        raise BadGateway(f"CLI del LLM no encontrada: {command[0]}")
    if result.returncode != 0:
        raise BadGateway(result.stderr.strip() or "La CLI del LLM falló")
    return Respuesta(texto=result.stdout.strip())
