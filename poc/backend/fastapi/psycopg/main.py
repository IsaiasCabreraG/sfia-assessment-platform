"""Módulo backend de la PoC (FastAPI + psycopg, SQL directo).

Valida el JWT HS256 emitido por el módulo de autenticación, registra al usuario en `users`
la primera vez que lo ve, y expone `GET /items`, `POST /items` y `POST /ai/ask`.
Es el único módulo de la PoC que accede a la base de datos.

Cómo probarlo (desde la raíz del repositorio). Requiere la BD levantada y, para /ai/ask,
el módulo LLM en el puerto 8002:

    mkvirtualenv -p python3 poc-backend-psycopg   # solo la primera vez
    workon poc-backend-psycopg
    pip install -r poc/backend/fastapi/psycopg/requirements.txt
    cd poc/backend/fastapi/psycopg
    cp .env.example .env                          # solo la primera vez; completa los valores
    uvicorn main:app --port 8000

Para obtener un token, inicia sesión en http://localhost:8001/auth/login (módulo de
autenticación) y copia el `access_token` (dura una hora). Luego, en otra terminal:

    TOKEN=<access_token>
    curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN"
    curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' -d '{"titulo":"Prueba","descripcion":"Primer ítem"}'
    curl -s localhost:8000/ai/ask -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' -d '{"prompt":"Di hola en una frase"}'
"""
import os
import platform
from importlib.metadata import version

import httpx
import jwt
import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from pydantic import BaseModel

load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET"]
LLM_URL = os.getenv("LLM_URL", "http://localhost:8002")
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "130"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")
DB_CONNINFO = make_conninfo(
    host=os.getenv("POC_DB_HOST", "localhost"),
    port=os.getenv("POC_DB_PORT", "5432"),
    dbname=os.environ["POC_DB_NAME"],
    user=os.environ["POC_DB_USER"],
    password=os.environ["POC_DB_PASSWORD"],
)

app = FastAPI(title="PoC - Backend (FastAPI + psycopg)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def connect() -> psycopg.Connection:
    # Una conexión por operación; el `with` confirma la transacción al salir.
    return psycopg.connect(DB_CONNINFO, row_factory=dict_row)


def usuario_actual(authorization: str = Header(default="")) -> dict:
    """Valida el JWT y devuelve la fila de `users`, creándola la primera vez."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta el token")
    try:
        datos = jwt.decode(
            authorization.removeprefix("Bearer "), JWT_SECRET, algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    with connect() as conn:
        user = conn.execute(
            "SELECT id, email, nombre FROM users WHERE google_id = %s", (datos["sub"],)
        ).fetchone()
        if user is None:
            user = conn.execute(
                "INSERT INTO users (email, nombre, google_id) VALUES (%s, %s, %s)"
                " RETURNING id, email, nombre",
                (datos["email"], datos["nombre"], datos["sub"]),
            ).fetchone()
    return user


def salud_propia() -> dict:
    return {
        "modulo": "backend",
        "variante": "fastapi-psycopg",
        "versiones": {
            "python": platform.python_version(),
            "fastapi": version("fastapi"),
            "psycopg": version("psycopg"),
        },
    }


@app.get("/health")
def health():
    return salud_propia()


def salud_de(modulo: str, url: str) -> dict:
    """Consulta el /health de otro módulo; si no responde, lo indica en vez de fallar."""
    try:
        resp = httpx.get(f"{url}/health", timeout=3)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError):
        return {"modulo": modulo, "variante": None, "error": "sin respuesta"}


@app.get("/modulos")
def modulos():
    """Variante y versiones de los módulos de la PoC, para identificar qué se está probando."""
    try:
        with connect() as conn:
            version_bd = conn.execute("SHOW server_version").fetchone()["server_version"].split()[0]
        bd = {"modulo": "db", "variante": "postgresql", "versiones": {"postgresql": version_bd}}
    except psycopg.Error:
        bd = {"modulo": "db", "variante": None, "error": "sin respuesta"}
    return [salud_propia(), salud_de("llm", LLM_URL), salud_de("auth", AUTH_URL), bd]


class ItemIn(BaseModel):
    titulo: str
    descripcion: str | None = None


class AskIn(BaseModel):
    prompt: str


@app.get("/items")
def listar_items(user: dict = Depends(usuario_actual)):
    with connect() as conn:
        return conn.execute(
            "SELECT i.id, i.titulo, i.descripcion, u.nombre AS creado_por, i.creado_en"
            " FROM items i JOIN users u ON u.id = i.creado_por ORDER BY i.id DESC"
        ).fetchall()


@app.post("/items", status_code=201)
def crear_item(item: ItemIn, user: dict = Depends(usuario_actual)):
    with connect() as conn:
        return conn.execute(
            "INSERT INTO items (titulo, descripcion, creado_por) VALUES (%s, %s, %s)"
            " RETURNING id, titulo, descripcion, creado_en",
            (item.titulo, item.descripcion, user["id"]),
        ).fetchone()


@app.post("/ai/ask")
def preguntar_a_la_ia(req: AskIn, user: dict = Depends(usuario_actual)):
    try:
        resp = httpx.post(
            f"{LLM_URL}/ask", json={"prompt": req.prompt}, timeout=LLM_TIMEOUT_SECONDS
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="No se pudo contactar al módulo LLM")
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502, detail=f"El módulo LLM respondió {resp.status_code}"
        )
    return resp.json()
