"""Lo que devuelve un proveedor de IA: el texto y los datos de la llamada."""
from dataclasses import dataclass, field

SIN_DATO = "--"  # lo que un proveedor no puede informar se deja en «--»


def _uso() -> dict:
    return {"prompt_tokens": SIN_DATO, "completion_tokens": SIN_DATO}


def _parametros() -> dict:
    return {"temperature": SIN_DATO, "reasoning_effort": SIN_DATO, "max_tokens": SIN_DATO}


@dataclass
class Respuesta:
    texto: str
    modelo: str = SIN_DATO
    uso: dict = field(default_factory=_uso)              # tokens del pedido y de la respuesta
    parametros: dict = field(default_factory=_parametros)  # temperatura, esfuerzo de razonamiento y máximo de tokens
    proveedor: str = SIN_DATO                            # lo completa provider.generate
    duracion_ms: int | str = SIN_DATO                    # lo completa provider.generate
