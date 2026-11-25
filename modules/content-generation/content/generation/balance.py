"""Balanceo del banco (HU-04-2 y HU-04-7): elige, antes de pedirlo a la IA, qué respuesta correcta debe
tener cada ítem nuevo, para que las correctas queden repartidas entre A, B, C y D (o entre verdadero y falso)."""
import random


def elegir_objetivos(conteos: list[int], cantidad: int, azar=random) -> list[int]:
    """Devuelve `cantidad` índices (0 = primera opción) a los que apuntar con los ítems nuevos.

    `conteos` es cuántas correctas hay hoy en cada opción del banco. Cada opción tiene más probabilidad
    cuanto menos correctas tiene: se sortea (y no se toma siempre la menor) para que dos pedidos en
    paralelo no elijan la misma. Dentro de un pedido, cada elección cuenta para la siguiente.
    """
    conteos = list(conteos)
    objetivos = []
    for _ in range(cantidad):
        mayor = max(conteos)
        pesos = [mayor - c + 1 for c in conteos]
        i = azar.choices(range(len(conteos)), weights=pesos)[0]
        objetivos.append(i)
        conteos[i] += 1
    return objetivos
