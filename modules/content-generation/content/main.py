"""App FastAPI del módulo content (puerto 8004)."""
from shared.app_factory import create_app

from content.routes import router

app = create_app("content", "Sprint 1 - Generación de Contenido")
app.include_router(router)
