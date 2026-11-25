"""IA simulada para la prueba E2E: lee el prompt por stdin y devuelve ítems de ejemplo del tipo y cantidad pedidos."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from tests.samples import respuesta_desde_prompt  # noqa: E402

print(respuesta_desde_prompt(sys.stdin.read()))
