"""Respuestas de ejemplo de la IA (válidas) para cada tipo de ítem, usadas por las pruebas."""
import json

_RUBRIC = [
    {"name": "Corrección técnica", "weight": 60,
     "levels": [{"score": s, "descriptor": f"Corrección nivel {s}"} for s in range(4)]},
    {"name": "Claridad", "weight": 40,
     "levels": [{"score": s, "descriptor": f"Claridad nivel {s}"} for s in range(4)]},
]
_BASE = {"statement": "Enunciado de prueba", "evaluation_goal": "Objetivo de prueba"}

SAMPLES = {
    "single_choice": {**_BASE, "options": [{"text": "A", "is_correct": False}, {"text": "B", "is_correct": True},
                                           {"text": "C", "is_correct": False}]},
    "true_false": {**_BASE, "correct_answer": True},
    "open_question": {**_BASE, "reference_answer": "Respuesta de referencia", "rubric": _RUBRIC},
    "coding": {**_BASE, "language": "python", "function_signature": "def suma(a, b) -> int",
               "starter_code": "def suma(a, b):\n    pass", "unit_tests": "assert suma(1, 2) == 3",
               "time_limit_seconds": 5, "memory_limit_mb": 128, "reference_solution": "def suma(a, b):\n    return a + b"},
    "system_design": {**_BASE, "scenario": "Un acortador de URLs", "functional_requirements": ["Acortar", "Redirigir"],
                      "non_functional_requirements": ["Alta disponibilidad"], "constraints": ["100M URLs"],
                      "reference_answer": "Clave base62, caché, réplicas", "rubric": _RUBRIC},
    "debugging": {**_BASE, "language": "python", "code": "def f(xs):\n    return xs[len(xs)]",
                  "symptom_input": "[1, 2]", "symptom_expected": "2", "symptom_observed": "IndexError",
                  "reference_answer": "Usar len(xs) - 1", "findings": [{"line": 2, "description": "Índice fuera de rango"}],
                  "rubric": _RUBRIC},
}


def llm_answer(item_type: str, count: int) -> str:
    """Texto que devolvería la IA: un JSON con `count` ítems del tipo pedido."""
    return json.dumps({"items": [SAMPLES[item_type]] * count})
