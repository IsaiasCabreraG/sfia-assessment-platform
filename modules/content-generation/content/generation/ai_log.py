"""Registro de las llamadas a la IA, SOLO PARA DESARROLLO: sirve para comparar modelos y revisar la calidad de las
respuestas al ajustar el prompt. Está apagado por defecto y en producción debe quedar apagado.

Se activa con `LOG_IA=1` en el `.env`. Guarda una línea JSON por intento (cada reintento es otra línea) en
`logs/ia/AAAA-MM-DD.jsonl` (la carpeta está en .gitignore; se cambia con `LOG_IA_DIR`). `LOG_IA_ETIQUETA` pone un
nombre al experimento para agrupar corridas. Para verlo: `bash tools/run_python.sh tools/ver_log_ia.py`.

Un fallo al escribir el log nunca interrumpe la generación. Para quitar el log basta borrar este módulo y sus llamadas
en `content/service.py` (`_ask`).
"""
import hashlib
import json
from datetime import datetime
from pathlib import Path

from shared.config import env

RUTA_PLANTILLA = Path(__file__).with_name("prompt.json")
CARPETA_POR_DEFECTO = Path(__file__).resolve().parents[4] / "logs" / "ia"


def activo() -> bool:
    return env("LOG_IA", "0").strip().lower() in ("1", "true", "si", "sí", "yes")


def _version_del_prompt() -> dict:
    """Versión de `prompt.json` y una huella de su contenido (cambia si se edita el texto sin cambiar la versión)."""
    texto = RUTA_PLANTILLA.read_text(encoding="utf-8")
    return {"version_prompt": json.loads(texto).get("version", "--"), "huella_prompt": hashlib.sha1(texto.encode("utf-8")).hexdigest()[:10]}


def registrar(*, meta: dict | None = None, **campos) -> None:
    """Agrega una línea al log del día si `LOG_IA` está activo. `meta` son los datos de la llamada que informó el
    módulo llm (proveedor, modelo, duración, tokens y parámetros); lo que falta se escribe como «--»."""
    if not activo():
        return
    try:
        meta = meta or {}
        registro = {
            "fecha": datetime.now().isoformat(timespec="seconds"),
            "etiqueta": env("LOG_IA_ETIQUETA", "") or "--",
            **_version_del_prompt(),
            **campos,
            "proveedor": meta.get("provider", "--"),
            "modelo": meta.get("model", "--"),
            "parametros": meta.get("parameters", "--"),
            "tokens": meta.get("usage", "--"),
            "duracion_ms": meta.get("duration_ms", "--"),
        }
        carpeta = Path(env("LOG_IA_DIR", str(CARPETA_POR_DEFECTO)))
        carpeta.mkdir(parents=True, exist_ok=True)
        with open(carpeta / f"{datetime.now():%Y-%m-%d}.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(registro, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001 — el log es una ayuda de desarrollo: nunca debe romper la generación
        pass
