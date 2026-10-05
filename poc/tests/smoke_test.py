#!/usr/bin/env python3
"""Prueba de humo de la PoC: ejercita el backend y el módulo LLM con un solo comando.

Uso (desde la raíz del repositorio), con la BD, el backend (8000) y el LLM (8002) corriendo:

    python3 poc/tests/smoke_test.py             # prueba completa
    python3 poc/tests/smoke_test.py --sin-llm   # omite las pruebas que llaman a la CLI (lentas)

No necesita entorno virtual (solo librería estándar). Fabrica un token con el JWT_SECRET
(del entorno o de poc/auth/authlib/.env), así que no depende del login con Google, que se
prueba a mano. Al inicio imprime la variante y las versiones de cada módulo (GET /health y
psql) y las repite en la línea final. Crea un usuario y un ítem de prueba y los borra al
terminar (usa psql con poc/db/.env). Termina con código distinto de cero si algo falla.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BACKEND = "http://localhost:8000"
LLM = "http://localhost:8002"
AUTH = "http://localhost:8001"
FRONTEND = "http://localhost:5173"
GOOGLE_ID_PRUEBA = "smoke-test"
NOMBRE_PRUEBA = "Smoke Test"

fallos = 0


def leer_env(ruta: Path) -> dict:
    valores = {}
    if ruta.exists():
        for linea in ruta.read_text().splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                clave, valor = linea.split("=", 1)
                valores[clave.strip()] = valor.strip()
    return valores


def b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def fabricar_token(secreto: str, expira_en: int = 3600) -> str:
    ahora = int(time.time())
    encabezado = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    datos = b64(
        json.dumps(
            {
                "sub": GOOGLE_ID_PRUEBA,
                "email": "smoke@test.local",
                "nombre": NOMBRE_PRUEBA,
                "iat": ahora,
                "exp": ahora + expira_en,
            },
            separators=(",", ":"),
        ).encode()
    )
    firma = b64(hmac.new(secreto.encode(), f"{encabezado}.{datos}".encode(), hashlib.sha256).digest())
    return f"{encabezado}.{datos}.{firma}"


def llamar(metodo: str, url: str, token: str | None = None, cuerpo=None, timeout: int = 150):
    """Devuelve (estado, cuerpo JSON). Estado None si no se pudo conectar."""
    cabeceras = {}
    if token:
        cabeceras["Authorization"] = f"Bearer {token}"
    datos = None
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode()
        cabeceras["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=datos, headers=cabeceras, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read() or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except ValueError:
            return e.code, None
    except urllib.error.URLError as e:
        return None, str(e.reason)


def comprobar(nombre: str, condicion: bool, detalle=None) -> None:
    global fallos
    if condicion:
        print(f"  OK      {nombre}")
    else:
        fallos += 1
        print(f"  FALLÓ   {nombre}  -> {detalle}")


def psql(sql: str, solo_datos: bool = False) -> str:
    env = leer_env(RAIZ / "db" / ".env")
    args = [
        "psql", "-h", env.get("POC_DB_HOST", "localhost"),
        "-p", env.get("POC_DB_PORT", "5432"),
        "-U", env["POC_DB_USER"], "-d", env["POC_DB_NAME"],
        "-v", "ON_ERROR_STOP=1",
    ]
    if solo_datos:
        args.append("-tA")
    args += ["-c", sql]
    resultado = subprocess.run(
        args, env={**os.environ, "PGPASSWORD": env["POC_DB_PASSWORD"]},
        check=True, capture_output=True, text=True,
    )
    return resultado.stdout.strip()


def limpiar_bd() -> None:
    sql = (
        "DELETE FROM items WHERE creado_por IN"
        f" (SELECT id FROM users WHERE google_id = '{GOOGLE_ID_PRUEBA}');"
        f" DELETE FROM users WHERE google_id = '{GOOGLE_ID_PRUEBA}';"
    )
    try:
        psql(sql)
        print("Limpieza: usuario e ítems de prueba borrados")
    except (KeyError, FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"Aviso: no se pudo limpiar la BD ({e}). "
              f"Borra a mano el usuario con google_id '{GOOGLE_ID_PRUEBA}' y sus ítems.")


def identificar_modulos(sin_llm: bool) -> str:
    """Imprime la variante y las versiones de cada módulo (GET /health y psql).
    Devuelve una etiqueta corta para la línea final."""
    global fallos
    # (nombre, url, ruta de identificación, obligatorio)
    modulos = [
        ("backend", BACKEND, "/health", True),
        ("llm", LLM, "/health", not sin_llm),
        ("auth", AUTH, "/health", False),
        ("frontend", FRONTEND, "/health.json", False),
    ]
    etiquetas = []
    print("Módulos bajo prueba")
    for nombre, url, ruta, obligatorio in modulos:
        if nombre == "llm" and sin_llm:
            print(f"  {nombre:<8}(omitido: --sin-llm)")
            continue
        estado, cuerpo = llamar("GET", f"{url}{ruta}", timeout=10)
        if estado == 200 and isinstance(cuerpo, dict) and cuerpo.get("modulo") == nombre:
            versiones = ", ".join(f"{k} {v}" for k, v in cuerpo.get("versiones", {}).items())
            extra = f" · comando: {cuerpo['comando']}" if "comando" in cuerpo else ""
            print(f"  {nombre:<8}{cuerpo.get('variante', '?'):<22}{versiones}{extra}")
            etiquetas.append(f"{nombre}={cuerpo.get('variante', '?')}")
        elif obligatorio:
            fallos += 1
            print(f"  {nombre:<8}NO IDENTIFICADO  -> {(estado, cuerpo)}")
        else:
            print(f"  {nombre:<8}no está corriendo (no hace falta para esta prueba)")
    try:
        version_bd = psql("SHOW server_version", solo_datos=True)
        print(f"  {'db':<8}PostgreSQL {version_bd}")
        etiquetas.append(f"db=PostgreSQL {version_bd.split()[0]}")
    except (KeyError, FileNotFoundError, subprocess.CalledProcessError):
        print(f"  {'db':<8}versión no disponible")
    print()
    return ", ".join(etiquetas)


def probar(sin_llm: bool, secreto: str) -> None:
    token = fabricar_token(secreto)
    titulo = f"Prueba de humo {int(time.time())}"

    print("Backend: autenticación")
    estado, cuerpo = llamar("GET", f"{BACKEND}/items")
    comprobar("sin token -> 401", estado == 401, (estado, cuerpo))
    estado, cuerpo = llamar("GET", f"{BACKEND}/items", token="abc")
    comprobar("token falso -> 401", estado == 401, (estado, cuerpo))
    estado, cuerpo = llamar("GET", f"{BACKEND}/items", token=fabricar_token(secreto + "x"))
    comprobar("token con otro secreto -> 401", estado == 401, (estado, cuerpo))
    estado, cuerpo = llamar("GET", f"{BACKEND}/items", token=fabricar_token(secreto, expira_en=-10))
    comprobar("token expirado -> 401", estado == 401, (estado, cuerpo))

    print("Backend: ítems")
    estado, cuerpo = llamar("GET", f"{BACKEND}/items", token=token)
    comprobar("GET /items con token -> 200 y lista", estado == 200 and isinstance(cuerpo, list), (estado, cuerpo))
    estado, cuerpo = llamar("POST", f"{BACKEND}/items", token=token,
                            cuerpo={"titulo": titulo, "descripcion": "creado por smoke_test"})
    comprobar("POST /items -> 201 con id", estado == 201 and "id" in (cuerpo or {}), (estado, cuerpo))
    estado, cuerpo = llamar("POST", f"{BACKEND}/items", token=token, cuerpo={})
    comprobar("POST /items sin título -> 422", estado == 422, (estado, cuerpo))
    estado, cuerpo = llamar("GET", f"{BACKEND}/items", token=token)
    encontrado = estado == 200 and any(
        i["titulo"] == titulo and i["creado_por"] == NOMBRE_PRUEBA for i in cuerpo
    )
    comprobar("el ítem creado aparece con su creado_por", encontrado, (estado, cuerpo))

    if sin_llm:
        print("LLM: omitido (--sin-llm)")
        return

    print("LLM")
    estado, cuerpo = llamar("POST", f"{LLM}/ask", cuerpo={"prompt": "Di hola en una frase"})
    comprobar("POST /ask directo -> 200 con answer", estado == 200 and (cuerpo or {}).get("answer"), (estado, cuerpo))
    estado, cuerpo = llamar("POST", f"{BACKEND}/ai/ask", token=token, cuerpo={"prompt": "Di hola en una frase"})
    comprobar("POST /ai/ask vía backend -> 200 con answer", estado == 200 and (cuerpo or {}).get("answer"), (estado, cuerpo))


def main() -> None:
    parser = argparse.ArgumentParser(description="Prueba de humo de la PoC")
    parser.add_argument("--sin-llm", action="store_true", help="omite las pruebas que llaman a la CLI")
    args = parser.parse_args()

    secreto = os.getenv("JWT_SECRET") or leer_env(RAIZ / "auth" / "authlib" / ".env").get("JWT_SECRET")
    if not secreto:
        sys.exit("No se encontró JWT_SECRET (variable de entorno o poc/auth/authlib/.env)")

    estado, detalle = llamar("GET", f"{BACKEND}/items")
    if estado is None:
        sys.exit(f"El backend no responde en {BACKEND}: {detalle}")

    etiqueta = identificar_modulos(args.sin_llm)
    try:
        probar(args.sin_llm, secreto)
    finally:
        limpiar_bd()

    resultado = "TODO OK" if fallos == 0 else f"{fallos} comprobación(es) fallaron"
    print(f"\n{resultado}  [{etiqueta}]")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
