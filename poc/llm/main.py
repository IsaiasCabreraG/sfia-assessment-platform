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
import shlex
import subprocess

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

CLI_COMMAND = shlex.split(os.getenv("LLM_CLI_COMMAND", "claude -p"))
TIMEOUT = int(os.getenv("LLM_TIMEOUT_SECONDS", "120"))

app = FastAPI(title="PoC - Módulo LLM")


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
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="La CLI excedió el tiempo límite")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"CLI no encontrada: {CLI_COMMAND[0]}")
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr.strip() or "La CLI falló")
    return AskResponse(answer=result.stdout.strip())
