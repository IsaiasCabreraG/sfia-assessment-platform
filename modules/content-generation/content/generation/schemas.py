"""Contenido que debe devolver la IA para cada tipo de ítem, con las reglas de negocio del
diccionario de tipos (`docs/architecture/item-types-dictionary.md`). Si la respuesta de la IA no
cumple, la validación falla y el ítem no se guarda."""
import re
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from content.generation.rubric import NUM_CRITERIOS, nombres_fijos

# Texto obligatorio: sin espacios sobrantes y con al menos un carácter.
Text = Field(min_length=1)


class _Model(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


class RubricLevel(_Model):
    score: int = Field(ge=0, le=3)
    descriptor: str = Text


class RubricCriterion(_Model):
    name: str = Text
    weight: int = Field(ge=1, le=100)
    levels: list[RubricLevel]

    @field_validator("levels")
    @classmethod
    def _cuatro_puntajes(cls, levels):
        if sorted(l.score for l in levels) != [0, 1, 2, 3]:
            raise ValueError("cada criterio necesita exactamente un descriptor por puntaje 0, 1, 2 y 3")
        return levels


class _Item(_Model):
    statement: str = Text
    evaluation_goal: str = Text


class _WithRubric(_Item):
    """Tipos abiertos: rúbrica de al menos 4 criterios, con los criterios fijos del tipo (config/criterios-fijos.json)
    y pesos que suman 100. Lo que genera la IA tiene exactamente 4 de peso 25 (ver checks.py); quien edita puede agregar más."""
    FIXED_CRITERIA: ClassVar[list[str]] = []
    rubric: list[RubricCriterion] = Field(min_length=NUM_CRITERIOS)

    @model_validator(mode="after")
    def _reglas_rubrica(self):
        if sum(c.weight for c in self.rubric) != 100:
            raise ValueError("los pesos de la rúbrica deben sumar 100")
        nombres = [c.name.lower() for c in self.rubric]
        if len(set(nombres)) != len(nombres):
            raise ValueError("los nombres de los criterios no pueden repetirse")
        faltan = [f for f in self.FIXED_CRITERIA if f.lower() not in nombres]
        if faltan:
            raise ValueError(f"la rúbrica debe incluir los criterios fijos: {', '.join(faltan)}")
        return self


class ChoiceOption(_Model):
    text: str = Text
    is_correct: bool


class SingleChoice(_Item):
    options: list[ChoiceOption] = Field(min_length=2)

    @model_validator(mode="after")
    def _una_correcta(self):
        if sum(o.is_correct for o in self.options) != 1:
            raise ValueError("exactamente una opción debe ser correcta")
        textos = [o.text.lower() for o in self.options]
        if len(set(textos)) != len(textos):
            raise ValueError("las opciones no pueden repetirse")
        return self


class TrueFalse(_Item):
    correct_answer: bool


class OpenQuestion(_WithRubric):
    FIXED_CRITERIA: ClassVar[list[str]] = nombres_fijos("open_question")
    reference_answer: str = Text


class Coding(_Item):
    language: str = Text
    function_signature: str = Text
    starter_code: str | None = None
    unit_tests: str = Text
    time_limit_seconds: int = Field(gt=0)
    memory_limit_mb: int = Field(gt=0)
    reference_solution: str = Text

    @model_validator(mode="after")
    def _starter_contiene_funcion(self):
        # La ejecución de reference_solution contra unit_tests (HU-21) queda fuera del Sprint 1.
        nombre = re.search(r"(\w+)\s*\(", self.function_signature)
        if self.starter_code and nombre and nombre.group(1) not in self.starter_code:
            raise ValueError("starter_code debe contener la función indicada en function_signature")
        return self


class SystemDesign(_WithRubric):
    FIXED_CRITERIA: ClassVar[list[str]] = nombres_fijos("system_design")
    scenario: str = Text
    functional_requirements: list[str] = Field(min_length=1)
    non_functional_requirements: list[str] = []
    constraints: list[str] = []
    reference_answer: str = Text


class Finding(_Model):
    line: int | None = Field(default=None, ge=1)
    description: str = Text


class Debugging(_WithRubric):
    FIXED_CRITERIA: ClassVar[list[str]] = nombres_fijos("debugging")
    language: str = Text
    code: str = Text
    symptom_input: str | None = None
    symptom_expected: str = Text
    symptom_observed: str = Text
    reference_answer: str = Text
    findings: list[Finding] = Field(min_length=1)

    @model_validator(mode="after")
    def _reglas_debugging(self):
        if self.symptom_expected == self.symptom_observed:
            raise ValueError("symptom_observed debe ser distinto de symptom_expected")
        lineas = len(self.code.splitlines())
        for f in self.findings:
            if f.line is not None and f.line > lineas:
                raise ValueError(f"el hallazgo indica la línea {f.line}, pero el código tiene {lineas}")
        return self


MODELS: dict[str, type[_Item]] = {
    "single_choice": SingleChoice,
    "true_false": TrueFalse,
    "open_question": OpenQuestion,
    "coding": Coding,
    "system_design": SystemDesign,
    "debugging": Debugging,
}


def validate_items(item_type: str, raw_items: list) -> list[_Item]:
    """Valida cada ítem crudo de la IA contra el modelo de su tipo. Lanza ValueError con el detalle."""
    model = MODELS[item_type]
    errores, validos = [], []
    for i, raw in enumerate(raw_items, start=1):
        try:
            validos.append(model.model_validate(raw))
        except ValidationError as e:
            detalle = "; ".join(f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors())
            errores.append(f"ítem {i}: {detalle}")
    if errores:
        raise ValueError(" | ".join(errores))
    return validos
