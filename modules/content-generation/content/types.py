"""Los seis tipos de ítem del banco (HU-10) y sus propiedades."""

ITEM_TYPES: dict[str, dict] = {
    "single_choice": {"label": "Alternativa única", "open": False},
    "true_false": {"label": "Verdadero o falso", "open": False},
    "open_question": {"label": "Pregunta de desarrollo", "open": True},
    "coding": {"label": "Coding challenge", "open": False},
    "system_design": {"label": "System design", "open": True},
    "debugging": {"label": "Debugging", "open": True},
}

# Los tipos abiertos son los únicos que llevan rúbrica.
OPEN_TYPES = {t for t, meta in ITEM_TYPES.items() if meta["open"]}

MAX_ITEMS_PER_REQUEST = 10
