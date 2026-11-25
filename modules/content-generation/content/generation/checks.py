"""Comprobaciones que hace el servicio al generar con la IA. Están aparte del schema para no limitar lo
que el docente edita a mano: solo se exigen a lo que devuelve la IA."""
import re

from content.generation.rubric import CRITERIOS_IA, PESO_CRITERIO, nombres_fijos

LETRAS = "ABCD"

# Opciones que dependen de otras ("Todas las anteriores", "A y B"…). Se permiten, pero solo en la última
# posición; si aparecen antes, la respuesta se rechaza. Las letras se buscan en mayúscula (A–D).
_POSICIONAL = re.compile(
    r"(?i:\b(?:todas|ninguna|ambas|cualquiera)\s+(?:de\s+)?(?:las\s+|los\s+)?(?:anteriores|opciones|alternativas|respuestas)\b)"
    r"|(?i:\b(?:todas|ninguna|ambas)\s+(?:son|es)\s+(?:correctas?|incorrectas?|verdaderas?|falsas?)\b)"
    r"|(?i:\blas\s+dos\s+(?:primeras|últimas|anteriores)\b)"
    r"|(?i:\bopci[oó]n(?:es)?\s+)[A-D]\b"
    r"|\b[A-D]\s*(?:y|o|e|,)\s*[A-D]\b"
)


def posicion_correcta(contenido) -> int:
    """Posición (1 a 4…) de la opción correcta de un ítem de alternativa única."""
    return next(i for i, o in enumerate(contenido.options, start=1) if o.is_correct)


def check_objetivos(item_type: str, contenidos: list, objetivos: list) -> None:
    """La correcta de cada ítem debe ser la que se pidió. Lanza ValueError con el detalle."""
    errores = []
    for i, (c, objetivo) in enumerate(zip(contenidos, objetivos), start=1):
        if item_type == "single_choice":
            real = posicion_correcta(c)
            if real != objetivo:
                errores.append(f"ítem {i}: la opción correcta debe ser la {LETRAS[objetivo - 1]} y es la {LETRAS[real - 1]}")
        elif item_type == "true_false" and c.correct_answer != objetivo:
            pedida = "verdadero" if objetivo else "falso"
            errores.append(f"ítem {i}: la respuesta correcta debe ser {pedida}")
    if errores:
        raise ValueError(" | ".join(errores))


def check_opciones_posicionales(contenidos: list) -> None:
    """Una opción que depende de otras solo puede ir en la última posición. Lanza ValueError con el detalle."""
    errores = []
    for i, c in enumerate(contenidos, start=1):
        for pos, opcion in enumerate(c.options[:-1], start=1):
            if _POSICIONAL.search(opcion.text):
                errores.append(f"ítem {i}: la opción {LETRAS[pos - 1]} depende de otras opciones "
                               f"(por ejemplo 'todas las anteriores' o 'A y B') y solo puede ir en la última posición")
    if errores:
        raise ValueError(" | ".join(errores))


def check_rubrica_ia(item_type: str, items: list) -> None:
    """Lo que escribe la IA de la rúbrica (los criterios fijos los agrega el servidor): exactamente 2 criterios
    de peso 25 y con nombres distintos de los fijos. Lanza ValueError con el detalle."""
    fijos = [n.lower() for n in nombres_fijos(item_type)]
    errores = []
    for i, item in enumerate(items, start=1):
        criterios = item.get("rubric") if isinstance(item, dict) else None
        if not isinstance(criterios, list) or len(criterios) != CRITERIOS_IA:
            errores.append(f"ítem {i}: la rúbrica debe tener exactamente {CRITERIOS_IA} criterios propios del problema")
            continue
        for c in criterios:
            if not isinstance(c, dict) or c.get("weight") != PESO_CRITERIO:
                errores.append(f"ítem {i}: cada criterio de la rúbrica debe pesar {PESO_CRITERIO}")
                break
            if str(c.get("name", "")).strip().lower() in fijos:
                errores.append(f"ítem {i}: el criterio '{c['name']}' ya es fijo y no debes escribirlo")
                break
    if errores:
        raise ValueError(" | ".join(errores))
