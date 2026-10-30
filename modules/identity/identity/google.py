"""Cliente OIDC de Google (Authlib). Solo configura el cliente; el flujo está en routes.py."""
from authlib.integrations.starlette_client import OAuth

from shared.config import env


def build_oauth() -> OAuth:
    oauth = OAuth()
    oauth.register(
        name="google",
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_id=env("GOOGLE_CLIENT_ID"),
        client_secret=env("GOOGLE_CLIENT_SECRET"),
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth
