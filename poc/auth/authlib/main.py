"""Módulo de autenticación de la PoC (Authlib): login con Google por redirección (OIDC)
y emisión de un JWT HS256. No accede a la base de datos.

Cómo probarlo (desde la raíz del repositorio):

    mkvirtualenv -p python3 poc-auth-authlib    # solo la primera vez
    workon poc-auth-authlib
    pip install -r poc/auth/authlib/requirements.txt
    cd poc/auth/authlib
    cp .env.example .env                        # solo la primera vez; completa los valores
    uvicorn main:app --port 8001

Luego abre en el navegador http://localhost:8001/auth/login, inicia sesión con Google
y la respuesta del callback será un JSON con el JWT.
"""
import os
import time

import jwt
from authlib.integrations.starlette_client import OAuth, OAuthError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from starlette.middleware.sessions import SessionMiddleware

load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_TTL_SECONDS = int(os.getenv("JWT_TTL_SECONDS", "3600"))
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8001/auth/callback")

app = FastAPI(title="PoC - Autenticación (Authlib)")
# Guarda el `state` del flujo OIDC entre la redirección a Google y el callback.
app.add_middleware(SessionMiddleware, secret_key=os.environ["SESSION_SECRET"])

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=os.environ["GOOGLE_CLIENT_ID"],
    client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    client_kwargs={"scope": "openid email profile"},
)


@app.get("/auth/login")
async def login(request: Request):
    return await oauth.google.authorize_redirect(request, REDIRECT_URI)


@app.get("/auth/callback")
async def callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=f"Error de Google: {e.error}")
    info = token["userinfo"]
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
