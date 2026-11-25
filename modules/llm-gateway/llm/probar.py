"""Comprueba que el proveedor de IA configurado en `.env` funciona.

Uso (desde la raíz del proyecto):
    bash tools/run_python.sh modules/llm-gateway/llm/probar.py                 # un pedido mínimo
    bash tools/run_python.sh modules/llm-gateway/llm/probar.py --modelos       # lista los modelos que tu cuenta de Groq puede usar
    bash tools/run_python.sh modules/llm-gateway/llm/probar.py --generacion    # además, genera 1 ítem verdadero/falso y lo valida
    bash tools/run_python.sh modules/llm-gateway/llm/probar.py --generacion open_question   # igual, con otro tipo (con rúbrica)

Con `--generacion` se usa el mismo prompt y las mismas validaciones que la aplicación; gasta unos 2.000 a 4.000 tokens.
"""
import sys
import time

from shared.config import env
from shared.errors import BadGateway

from llm.groq import listar_modelos
from llm.provider import generate


def main() -> int:
    proveedor = env("LLM_PROVIDER", "cli")
    modelo = env("LLM_MODEL", "(el de la CLI)") if proveedor == "groq" else env("LLM_CLI_COMMAND", "claude -p")
    print(f"Proveedor: {proveedor} · {modelo}")
    try:
        if "--modelos" in sys.argv:
            for m in listar_modelos():
                print(f"  {m['id']:<45} contexto={m.get('context_window')}")
            return 0
        t0 = time.time()
        respuesta = generate("Responde únicamente con la palabra: ok")
        print(f"1) Pedido mínimo: «{respuesta.texto[:60]}»  ({time.time() - t0:.1f} s) · modelo: {respuesta.modelo} · tokens: {respuesta.uso}")
        if "--generacion" in sys.argv:
            from content.generation.parser import extract_json
            from content.generation.prompts import build_prompt
            from content.generation.schemas import validate_items

            tipo = sys.argv[sys.argv.index("--generacion") + 1] if len(sys.argv) > sys.argv.index("--generacion") + 1 else "true_false"
            prompt = build_prompt(skill={"code": "PROG", "name": "Programming/software development", "description": "Design, create, modify and test software components."},
                                  level=3, level_title="Apply", item_type=tipo, count=1,
                                  estimated_minutes=5, context=None)
            t0 = time.time()
            texto = generate(prompt).texto
            items = validate_items(tipo, extract_json(texto)["items"])
            print(f"2) Generación de un ítem {tipo}: válido ({time.time() - t0:.1f} s)")
            print(f"   Enunciado: {items[0].statement}")
    except BadGateway as e:
        print(f"FALLÓ: {e.mensaje}")
        return 1
    except ValueError as e:
        print(f"La IA respondió, pero no cumple el formato esperado: {e}")
        return 1
    print("Todo bien.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
