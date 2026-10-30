"""IA simulada para la prueba E2E: lee el prompt por stdin y devuelve ítems de ejemplo del tipo y cantidad pedidos."""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from tests.samples import llm_answer  # noqa: E402

prompt = sys.stdin.read()
tipo = re.search(r"de tipo `(\w+)`", prompt).group(1)
cantidad = int(re.search(r"Genera (\d+)", prompt).group(1))
print(llm_answer(tipo, cantidad))
