"""Endpoint del módulo LLM: `POST /ask` (prompt → texto y datos de la llamada)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from shared.security import require_roles

from llm.provider import generate
from llm.respuesta import SIN_DATO

router = APIRouter(dependencies=[Depends(require_roles("teacher_recruiter", "validator", "admin"))])


class AskRequest(BaseModel):
    prompt: str


class AskResponse(BaseModel):
    answer: str
    # Datos de la llamada (sirven para el log de desarrollo); lo que el proveedor no informa es «--».
    provider: str = SIN_DATO
    model: str = SIN_DATO
    duration_ms: int | str = SIN_DATO
    usage: dict = {"prompt_tokens": SIN_DATO, "completion_tokens": SIN_DATO}
    parameters: dict = {"temperature": SIN_DATO, "reasoning_effort": SIN_DATO, "max_tokens": SIN_DATO}


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest) -> AskResponse:
    r = generate(req.prompt)
    return AskResponse(answer=r.texto, provider=r.proveedor, model=r.modelo, duration_ms=r.duracion_ms,
                       usage=r.uso, parameters=r.parametros)
