"""Estructura de la rúbrica de los tipos abiertos (HU-04-5 y HU-04-6).

Lo que genera la IA tiene 4 criterios de peso 25: los dos primeros son fijos por tipo de ítem (con sus
cuatro descriptores, en `config/criterios-fijos.json`, que también lee el portal) y se agregan solos; la IA
solo escribe los otros dos, según el problema. Quien revisa o edita puede agregar más criterios.
"""
import json
from pathlib import Path

NUM_CRITERIOS = 4        # mínimo de una rúbrica; es también lo que genera la IA
CRITERIOS_IA = 2         # los que escribe la IA (el resto son fijos)
PESO_CRITERIO = 25       # peso de cada criterio generado

RUTA_CRITERIOS_FIJOS = Path(__file__).resolve().parents[4] / "config" / "criterios-fijos.json"


def _cargar() -> dict[str, list[dict]]:
    """Lee los criterios fijos y comprueba que cada tipo abierto tenga los suyos, completos."""
    datos = json.loads(RUTA_CRITERIOS_FIJOS.read_text(encoding="utf-8"))
    fijos = {tipo: criterios for tipo, criterios in datos.items() if tipo != "descripcion"}
    for tipo, criterios in fijos.items():
        if len(criterios) != NUM_CRITERIOS - CRITERIOS_IA:
            raise RuntimeError(f"criterios-fijos.json: '{tipo}' debe tener {NUM_CRITERIOS - CRITERIOS_IA} criterios")
        for c in criterios:
            if c["weight"] != PESO_CRITERIO or sorted(n["score"] for n in c["levels"]) != [0, 1, 2, 3]:
                raise RuntimeError(f"criterios-fijos.json: '{c['name']}' debe pesar {PESO_CRITERIO} y tener los puntajes 0 a 3")
    return fijos


CRITERIOS_FIJOS: dict[str, list[dict]] = _cargar()


def nombres_fijos(item_type: str) -> list[str]:
    """Nombres de los criterios fijos del tipo (vacío si el tipo no lleva rúbrica)."""
    return [c["name"] for c in CRITERIOS_FIJOS.get(item_type, [])]


def con_criterios_fijos(item_type: str, item: dict) -> dict:
    """El ítem con su rúbrica completa: los criterios fijos del tipo primero y luego los que escribió la IA."""
    return {**item, "rubric": json.loads(json.dumps(CRITERIOS_FIJOS[item_type])) + list(item["rubric"])}
