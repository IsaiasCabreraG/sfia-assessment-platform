"""App FastAPI del módulo llm (puerto 8003)."""
from shared.app_factory import create_app

from llm.routes import router

app = create_app("llm", "Sprint 1 - Módulo LLM")
app.include_router(router)
