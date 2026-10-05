"""Módulo backend de la PoC (FastAPI + SQLAlchemy, ORM).

Mismo contrato que la variante FastAPI + psycopg: valida el JWT HS256 emitido por el módulo
de autenticación, registra al usuario en `users` la primera vez que lo ve, y expone
`GET /items`, `POST /items`, `POST /ai/ask` y `GET /health`. Es el único módulo de la PoC
que accede a la base de datos. Las tablas ya existen (poc/db/schema.sql): el ORM solo las mapea.

Cómo probarlo (desde la raíz del repositorio). Requiere la BD levantada y, para /ai/ask,
el módulo LLM en el puerto 8002. Detén antes la otra variante del backend (ambas usan el 8000):

    mkvirtualenv -p python3 poc-backend-sqlalchemy   # solo la primera vez
    workon poc-backend-sqlalchemy
    pip install -r poc/backend/fastapi/sqlalchemy/requirements.txt
    cd poc/backend/fastapi/sqlalchemy
    cp .env.example .env                             # solo la primera vez; completa los valores
    uvicorn main:app --port 8000

Prueba automática (desde la raíz del repositorio):

    python3 poc/tests/smoke_test.py

Prueba manual: saca un token en http://localhost:8001/auth/login (módulo de autenticación) y:

    TOKEN=<access_token>
    curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN"
    curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' -d '{"titulo":"Prueba","descripcion":"Primer ítem"}'
    curl -s localhost:8000/ai/ask -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' -d '{"prompt":"Di hola en una frase"}'
"""
import os
import platform
from datetime import datetime
from importlib.metadata import version

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import BigInteger, DateTime, ForeignKey, create_engine, func, select, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    joinedload,
    mapped_column,
    relationship,
)

load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET"]
LLM_URL = os.getenv("LLM_URL", "http://localhost:8002")
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "130"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")

engine = create_engine(
    URL.create(
        "postgresql+psycopg",
        username=os.environ["POC_DB_USER"],
        password=os.environ["POC_DB_PASSWORD"],
        host=os.getenv("POC_DB_HOST", "localhost"),
        port=int(os.getenv("POC_DB_PORT", "5432")),
        database=os.environ["POC_DB_NAME"],
    )
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str]
    nombre: Mapped[str]
    google_id: Mapped[str]
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    titulo: Mapped[str]
    descripcion: Mapped[str | None]
    creado_por: Mapped[int] = mapped_column(ForeignKey("users.id"))
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    autor: Mapped[User] = relationship()


app = FastAPI(title="PoC - Backend (FastAPI + SQLAlchemy)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def salud_propia() -> dict:
    return {
        "modulo": "backend",
        "variante": "fastapi-sqlalchemy",
        "versiones": {
            "python": platform.python_version(),
            "fastapi": version("fastapi"),
            "sqlalchemy": version("sqlalchemy"),
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
        with Session(engine) as db:
            version_bd = db.execute(text("SHOW server_version")).scalar_one().split()[0]
        bd = {"modulo": "db", "variante": "postgresql", "versiones": {"postgresql": version_bd}}
    except SQLAlchemyError:
        bd = {"modulo": "db", "variante": None, "error": "sin respuesta"}
    return [salud_propia(), salud_de("llm", LLM_URL), salud_de("auth", AUTH_URL), bd]


def usuario_actual(authorization: str = Header(default="")) -> dict:
    """Valida el JWT y devuelve los datos de `users`, creando la fila la primera vez."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta el token")
    try:
        datos = jwt.decode(
            authorization.removeprefix("Bearer "), JWT_SECRET, algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    with Session(engine) as db:
        user = db.scalar(select(User).where(User.google_id == datos["sub"]))
        if user is None:
            user = User(email=datos["email"], nombre=datos["nombre"], google_id=datos["sub"])
            db.add(user)
            db.commit()
            db.refresh(user)
        return {"id": user.id, "email": user.email, "nombre": user.nombre}


class ItemIn(BaseModel):
    titulo: str
    descripcion: str | None = None


class AskIn(BaseModel):
    prompt: str


@app.get("/items")
def listar_items(user: dict = Depends(usuario_actual)):
    with Session(engine) as db:
        items = db.scalars(
            select(Item).options(joinedload(Item.autor)).order_by(Item.id.desc())
        ).all()
        return [
            {
                "id": i.id,
                "titulo": i.titulo,
                "descripcion": i.descripcion,
                "creado_por": i.autor.nombre,
                "creado_en": i.creado_en,
            }
            for i in items
        ]


@app.post("/items", status_code=201)
def crear_item(item: ItemIn, user: dict = Depends(usuario_actual)):
    with Session(engine) as db:
        nuevo = Item(titulo=item.titulo, descripcion=item.descripcion, creado_por=user["id"])
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return {
            "id": nuevo.id,
            "titulo": nuevo.titulo,
            "descripcion": nuevo.descripcion,
            "creado_en": nuevo.creado_en,
        }


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
