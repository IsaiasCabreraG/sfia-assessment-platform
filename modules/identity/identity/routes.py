"""Endpoints HTTP de identity (HU-01): login con Google, callback y datos del usuario."""
from urllib.parse import urlencode

import httpx
from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from fastapi.responses import RedirectResponse

from shared.config import env
from shared.db import get_conn
from shared.security import AuthUser, current_user

from identity import service
from identity.google import build_oauth

router = APIRouter(prefix="/auth", tags=["auth"])
oauth = build_oauth()

PORTALES = {"docente": "PORTAL_DOCENTE_URL", "validador": "PORTAL_VALIDADOR_URL"}


@router.get("/login")
async def login(request: Request, portal: str = "docente"):
    """Inicia el flujo OIDC: guarda a qué portal volver y redirige a Google."""
    if portal not in PORTALES:
        raise HTTPException(status_code=400, detail=f"Portal inválido: {portal}")
    request.session["portal"] = portal
    return await oauth.google.authorize_redirect(request, env("GOOGLE_REDIRECT_URI"))


@router.get("/callback")
async def callback(request: Request, conn=Depends(get_conn, scope="function")):
    """Google vuelve aquí: se registra al usuario y se redirige al portal con los tokens en el fragmento."""
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=f"Error de Google: {e.error}")
    except httpx.HTTPError:  # la red falló al hablar con Google (tiempo agotado, conexión caída…)
        raise HTTPException(status_code=502, detail="No se pudo contactar a Google para completar el inicio de sesión. "
                                                     "Vuelve a intentarlo desde el portal.")
    with conn.cursor() as cur:
        _, access_token, refresh_token = service.login_with_google(cur, dict(token["userinfo"]))
    portal = request.session.pop("portal", "docente")
    destino = env(PORTALES[portal])
    tokens = {"access_token": access_token, "refresh_token": refresh_token}
    return RedirectResponse(f"{destino}#{urlencode(tokens)}")


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh(body: RefreshBody, conn=Depends(get_conn, scope="function")):
    """Renueva la sesión: cambia un refresh token por un access token y un refresh token nuevos."""
    with conn.cursor() as cur:
        access, refresh_token = service.refresh_session(cur, body.refresh_token)
    return {"access_token": access, "refresh_token": refresh_token}


@router.post("/logout", status_code=204)
def logout(body: RefreshBody, conn=Depends(get_conn, scope="function")):
    """Cierra la sesión: revoca el refresh token."""
    with conn.cursor() as cur:
        service.logout(cur, body.refresh_token)


@router.get("/me")
def me(user: AuthUser = Depends(current_user), conn=Depends(get_conn, scope="function")):
    """Usuario y roles vigentes en la BD (el JWT puede traer roles anteriores a un cambio)."""
    with conn.cursor() as cur:
        return service.user_with_roles(cur, user.id)
