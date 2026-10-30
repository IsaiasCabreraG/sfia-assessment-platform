"""Configuración común: lee las variables de entorno (y `.env` de la raíz del proyecto)."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


def env(nombre: str, por_defecto: str | None = None) -> str:
    """Devuelve la variable `nombre`; si falta y no hay valor por defecto, falla con un mensaje claro."""
    valor = os.getenv(nombre, por_defecto)
    if valor is None or valor == "":
        if por_defecto is not None:
            return por_defecto
        raise RuntimeError(f"Falta la variable de entorno {nombre} (revisa .env)")
    return valor


def env_lista(nombre: str, por_defecto: str = "") -> list[str]:
    """Variable con valores separados por coma, como lista sin espacios ni vacíos."""
    return [v.strip() for v in os.getenv(nombre, por_defecto).split(",") if v.strip()]
