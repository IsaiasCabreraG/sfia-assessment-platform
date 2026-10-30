"""Construye la app FastAPI base de cada módulo: CORS, manejo de errores y /health."""
import platform
from importlib.metadata import version

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import env_lista
from shared.errors import register_error_handlers


def create_app(modulo: str, titulo: str) -> FastAPI:
    app = FastAPI(title=titulo)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=env_lista("CORS_ORIGINS", "http://localhost:5173"),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    @app.get("/health")
    def health():
        return {
            "modulo": modulo,
            "versiones": {"python": platform.python_version(), "fastapi": version("fastapi")},
        }

    return app
