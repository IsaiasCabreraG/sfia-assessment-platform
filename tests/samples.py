"""Respuestas de ejemplo de la IA (válidas) para cada tipo de ítem, usadas por las pruebas."""
import copy
import json
import re

from content.generation.rubric import CRITERIOS_FIJOS, PESO_CRITERIO


def rubrica_propia() -> list[dict]:
    """Los 2 criterios que escribe la IA (peso 25 cada uno); los fijos los agrega el servidor."""
    return [{"name": f"Criterio propio {n}", "weight": PESO_CRITERIO,
             "levels": [{"score": s, "descriptor": f"Criterio propio {n}, nivel {s}"} for s in range(4)]} for n in (1, 2)]


def rubrica(item_type: str) -> list[dict]:
    """Rúbrica completa y válida: los criterios fijos del tipo (de config/criterios-fijos.json) y 2 propios."""
    return copy.deepcopy(CRITERIOS_FIJOS[item_type]) + rubrica_propia()


_BASE = {"statement": "Enunciado de prueba", "evaluation_goal": "Objetivo de prueba"}

SAMPLES = {
    "single_choice": {**_BASE, "options": [{"text": "A", "is_correct": False}, {"text": "B", "is_correct": True},
                                           {"text": "C", "is_correct": False}]},
    "true_false": {**_BASE, "correct_answer": True},
    "open_question": {**_BASE, "reference_answer": "Respuesta de referencia", "rubric": rubrica("open_question")},
    "coding": {**_BASE, "language": "python", "function_signature": "def suma(a, b) -> int",
               "starter_code": "def suma(a, b):\n    pass", "unit_tests": "assert suma(1, 2) == 3",
               "time_limit_seconds": 5, "memory_limit_mb": 128, "reference_solution": "def suma(a, b):\n    return a + b"},
    "system_design": {**_BASE, "scenario": "Un acortador de URLs", "functional_requirements": ["Acortar", "Redirigir"],
                      "non_functional_requirements": ["Alta disponibilidad"], "constraints": ["100M URLs"],
                      "reference_answer": "Clave base62, caché, réplicas", "rubric": rubrica("system_design")},
    "debugging": {**_BASE, "language": "python", "code": "def f(xs):\n    return xs[len(xs)]",
                  "symptom_input": "[1, 2]", "symptom_expected": "2", "symptom_observed": "IndexError",
                  "reference_answer": "Usar len(xs) - 1", "findings": [{"line": 2, "description": "Índice fuera de rango"}],
                  "rubric": rubrica("debugging")},
}


class RespuestaIA(str):
    """Respuesta válida de la IA para `count` ítems de un tipo. La IA simulada la adapta al prompt que recibe
    (posición de la correcta, paso de la respuesta de referencia), como lo haría una IA que obedece."""

    def __new__(cls, item_type: str, count: int, bloque: bool = False):
        obj = super().__new__(cls, json.dumps({"items": [SAMPLES[item_type]] * count}))
        obj.item_type, obj.count, obj.bloque = item_type, count, bloque
        return obj


def llm_answer(item_type: str, count: int, bloque: bool = False) -> RespuestaIA:
    """Lo que devolvería la IA: un JSON con `count` ítems del tipo pedido (`bloque`: dentro de un bloque ```json)."""
    return RespuestaIA(item_type, count, bloque)


def es_prompt_de_referencia(prompt: str) -> bool:
    return "Escribe la respuesta de referencia de cada ítem" in prompt


def respuesta_desde_prompt(prompt: str, item_type: str | None = None, count: int | None = None, bloque: bool = False) -> str:
    """Respuesta de una IA que obedece el prompt: respeta la posición o respuesta correcta pedida para cada
    ítem y, en el paso de las respuestas de referencia, responde solo con ellas."""
    if es_prompt_de_referencia(prompt):
        n = int(re.search(r"Hay (\d+) ítem", prompt).group(1))
        return json.dumps({"items": [{"reference_answer": f"Referencia de prueba {i}"} for i in range(1, n + 1)]})
    item_type = item_type or re.search(r"de tipo `(\w+)`", prompt).group(1)
    count = count if count is not None else int(re.search(r"Genera (\d+)", prompt).group(1))
    posiciones = re.findall(r"ítem \d+ → ([A-D])", prompt)
    respuestas = re.findall(r"ítem \d+ → (verdadero|falso)", prompt)
    items = []
    for i in range(count):
        item = copy.deepcopy(SAMPLES[item_type])
        if item_type == "single_choice" and i < len(posiciones):
            item["options"] = [{"text": f"Alternativa {letra}", "is_correct": letra == posiciones[i]} for letra in "ABCD"]
        if item_type == "true_false" and i < len(respuestas):
            item["correct_answer"] = respuestas[i] == "verdadero"
        if "rubric" in item:  # en el primer paso la IA escribe solo sus 2 criterios; los fijos los agrega el servidor
            item["rubric"] = rubrica_propia()
        items.append(item)
    texto = json.dumps({"items": items})
    return f"```json\n{texto}\n```" if bloque else texto
