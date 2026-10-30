"""Endpoint del módulo LLM: `POST /ask` (prompt → texto)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from shared.security import require_roles

from llm.provider import generate

router = APIRouter(dependencies=[Depends(require_roles("teacher_recruiter", "validator", "admin"))])


class AskRequest(BaseModel):
    prompt: str


class AskResponse(BaseModel):
    answer: str


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest) -> AskResponse:
    return AskResponse(answer=generate(req.prompt))
