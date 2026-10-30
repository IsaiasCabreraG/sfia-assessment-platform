"""App FastAPI del módulo identity (puerto 8001)."""
from starlette.middleware.sessions import SessionMiddleware

from shared.app_factory import create_app
from shared.config import env

from identity.routes import router

app = create_app("identity", "Sprint 1 - Identidad y Acceso")
# Guarda el `state` del flujo OIDC y el portal de destino entre /auth/login y /auth/callback.
app.add_middleware(SessionMiddleware, secret_key=env("SESSION_SECRET"))
app.include_router(router)
