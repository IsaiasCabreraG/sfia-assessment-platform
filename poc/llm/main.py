"""Módulo LLM de la PoC: expone `POST /ask` y delega en una CLI local por subproceso.

Cómo probarlo (desde la raíz del repositorio):

    mkvirtualenv -p python3 poc-llm          # solo la primera vez
    workon poc-llm
    pip install -r poc/llm/requirements.txt
    cd poc/llm
    cp .env.example .env                     # solo la primera vez
    uvicorn main:app --port 8002

En otra terminal:

    curl -s localhost:8002/ask -H 'Content-Type: application/json' \
        -d '{"prompt":"Di hola en una frase"}'
"""
import os
import platform
import shlex
import subprocess
import tempfile
from importlib.metadata import version

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

CLI_COMMAND = shlex.split(os.getenv("LLM_CLI_COMMAND", "claude -p"))
TIMEOUT = int(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
# Carpeta desde la que se lanza la CLI. Debe ser neutra: si está dentro de un proyecto, la CLI
# carga su CLAUDE.md y su memoria y contamina las respuestas.
CLI_CWD = os.getenv("LLM_CLI_CWD") or tempfile.gettempdir()

app = FastAPI(title="PoC - Módulo LLM")


@app.get("/health")
def health():
    return {
        "modulo": "llm",
        "variante": "python-cli",
        "versiones": {"python": platform.python_version(), "fastapi": version("fastapi")},
        "comando": " ".join(CLI_COMMAND),
        "cwd": CLI_CWD,
    }


class AskRequest(BaseModel):
    prompt: str


class AskResponse(BaseModel):
    answer: str


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest) -> AskResponse:
    # Prompt por stdin y sin shell: evita inyección de comandos.
    try:
        result = subprocess.run(
            CLI_COMMAND,
            input=req.prompt,
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            cwd=CLI_CWD,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="La CLI excedió el tiempo límite")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"CLI no encontrada: {CLI_COMMAND[0]}")
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr.strip() or "La CLI falló")
    return AskResponse(answer=result.stdout.strip())
