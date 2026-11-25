"""App FastAPI del módulo builder (puerto 8005)."""
from shared.app_factory import create_app

from builder.routes import router

app = create_app("builder", "Sprint 2 - Constructor de Evaluaciones")
app.include_router(router)
