"""App FastAPI del módulo catalog (puerto 8002)."""
from shared.app_factory import create_app

from catalog.routes import router

app = create_app("catalog", "Sprint 1 - Catálogo SFIA")
app.include_router(router)
