"""Módulo de autenticación de la PoC (google-auth): verifica el ID token que el frontend
obtiene con el botón "Sign in with Google" y emite un JWT HS256. No accede a la base de datos.

ESTADO: escrito, no probado. Se probará cuando exista el frontend.

Cómo probarlo (desde la raíz del repositorio):

    mkvirtualenv -p python3 poc-auth-google     # solo la primera vez
    workon poc-auth-google
    pip install -r poc/auth/google-auth/requirements.txt
    cd poc/auth/google-auth
    cp .env.example .env                        # solo la primera vez; completa los valores
    uvicorn main:app --port 8001

El frontend (http://localhost:5173) obtiene el ID token con el botón de Google y lo envía:

    POST http://localhost:8001/auth/google   {"id_token": "<token de Google>"}
"""
import os
import time

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel

load_dotenv()

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_TTL_SECONDS = int(os.getenv("JWT_TTL_SECONDS", "3600"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app = FastAPI(title="PoC - Autenticación (google-auth)")
# El navegador llama a este módulo directamente desde el frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class GoogleLoginRequest(BaseModel):
    id_token: str


@app.post("/auth/google")
def google_login(req: GoogleLoginRequest):
    try:
        info = id_token.verify_oauth2_token(
            req.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="ID token de Google inválido")
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="El correo de Google no está verificado")
    now = int(time.time())
    claims = {
        "sub": info["sub"],
        "email": info["email"],
        "nombre": info.get("name", info["email"]),
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
    }
    return {
        "access_token": jwt.encode(claims, JWT_SECRET, algorithm="HS256"),
        "token_type": "bearer",
        "expires_in": JWT_TTL_SECONDS,
    }
