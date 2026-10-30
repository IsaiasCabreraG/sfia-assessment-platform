"""Crea usuarios de prueba y las sesiones (access + refresh) que necesitan las pruebas E2E.
Uso: make_token.py <ruta-salida.json>"""
import json
import sys
import time

import jwt

from identity import service
from shared.config import env
from shared.db import connect
from tests.conftest import make_user


def nueva_sesion(user_id) -> dict:
    """Sesión real: access con los roles actuales y un refresh token propio (cada uno sirve una sola vez)."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM identity.users WHERE id = %s", (user_id,))
        access, refresh = service._start_session(cur, cur.fetchone())
    return {"access": access, "refresh": refresh}


def vencido(access: str) -> str:
    claims = jwt.decode(access, env("JWT_SECRET"), algorithms=["HS256"])
    return jwt.encode({**claims, "iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600},
                      env("JWT_SECRET"), algorithm="HS256")


a = make_user(["teacher_recruiter", "validator"])
b = make_user(["validator"])
token_viejo_de_b = b["headers"]["Authorization"].removeprefix("Bearer ")  # solo trae el rol validator
with connect() as conn, conn.cursor() as cur:  # se autoriza a B DESPUÉS de que iniciara sesión
    cur.execute("INSERT INTO identity.user_roles (user_id, role) VALUES (%s, 'teacher_recruiter')", (b["id"],))

sesion = {n: nueva_sesion(a["id"]) for n in ("generar", "vencida", "invalida", "a_mitad", "salir", "red_caida", "sesion_perdida", "reentrada")}
sesion["vencida"]["access"] = vencido(sesion["vencida"]["access"])
sesion["invalida"] = {"access": vencido(sesion["invalida"]["access"]), "refresh": "no-existe"}
sesion["rol_nuevo"] = {"access": token_viejo_de_b, "refresh": nueva_sesion(b["id"])["refresh"]}
json.dump(sesion, open(sys.argv[1], "w"))
