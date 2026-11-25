"""Refinamiento del Sprint 1 en la generación con IA: balanceo de correctas (HU-04-2, HU-04-7), alternativas
(HU-04-3), dos pasos en los tipos abiertos (HU-04-4) y rúbrica de 4 criterios con criterios fijos (HU-04-5, HU-04-6)."""
import json
import random
import re

import pytest

from content import repository
from content.generation.balance import elegir_objetivos
from content.generation.rubric import CRITERIOS_FIJOS, PESO_CRITERIO, nombres_fijos
from content.generation.schemas import validate_items
from content.types import OPEN_TYPES
from shared.db import connect
from tests.helpers import borradores, publicar
from tests.samples import SAMPLES, llm_answer, rubrica, rubrica_propia


def _con_opciones(textos: list[str], correcta: int) -> str:
    """Respuesta de la IA con un ítem de alternativa única cuyas opciones son `textos` (correcta: posición 1 a 4)."""
    item = {**SAMPLES["single_choice"],
            "options": [{"text": t, "is_correct": i == correcta} for i, t in enumerate(textos, start=1)]}
    return json.dumps({"items": [item]})


# ---------- HU-04-2 y HU-04-7: balanceo ----------

def test_los_objetivos_se_reparten_segun_lo_que_ya_hay_en_el_banco():
    objetivos = elegir_objetivos([40, 0, 0, 0], 60, random.Random(7))
    nuevos = [objetivos.count(i) for i in range(4)]
    assert nuevos[0] < min(nuevos[1:])             # la opción más cargada recibe menos
    assert max(nuevos[1:]) - min(nuevos[1:]) <= 8  # y el resto queda parejo


def test_con_un_banco_vacio_los_objetivos_son_parejos():
    objetivos = elegir_objetivos([0, 0, 0, 0], 400, random.Random(3))
    assert all(60 <= objetivos.count(i) <= 140 for i in range(4))


def test_el_prompt_de_alternativa_unica_fija_la_posicion_de_la_correcta(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("single_choice", 3)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", count=3)
    pedidas = re.findall(r"ítem \d+ → ([A-D])", fake_llm.prompts[0])
    assert len(pedidas) == 3
    reales = ["ABCD"[next(i for i, o in enumerate(d["options"]) if o["is_correct"])] for d in r.json()["drafts"]]
    assert reales == pedidas and all(len(d["options"]) == 4 for d in r.json()["drafts"])


def test_el_prompt_de_verdadero_o_falso_fija_la_respuesta_correcta(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [llm_answer("true_false", 4)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "true_false", count=4)
    pedidas = re.findall(r"ítem \d+ → (verdadero|falso)", fake_llm.prompts[0])
    assert [d["correct_answer"] for d in r.json()["drafts"]] == [p == "verdadero" for p in pedidas] and len(pedidas) == 4


@pytest.mark.parametrize("pedido,esperado", [({"correct_position": 3}, "ítem 1 → C"),
                                             ({"correct_answer": False}, "ítem 1 → falso")])
def test_al_regenerar_se_conserva_la_correcta_que_tenia(content_client, docente, skill_ids, fake_llm, pedido, esperado):
    tipo = "single_choice" if "correct_position" in pedido else "true_false"
    fake_llm.respuestas = [llm_answer(tipo, 1)]
    r = borradores(content_client, docente, skill_ids[0]["id"], tipo, count=1, feedback="otra",
                   previous_statement="x", **pedido)
    assert r.status_code == 200 and esperado in fake_llm.prompts[0]


def test_si_la_ia_no_respeta_la_posicion_se_reintenta(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [_con_opciones(["a1", "b2", "c3", "d4"], correcta=1), llm_answer("single_choice", 1)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", correct_position=3, feedback="x")
    assert r.status_code == 200 and len(fake_llm.prompts) == 2
    assert "la opción correcta debe ser la C y es la A" in fake_llm.prompts[1]


def test_el_conteo_del_banco_sube_al_publicar_una_alternativa_con_la_correcta_en_d(content_client, docente, skill_ids):
    with connect() as conn, conn.cursor() as cur:
        antes = repository.correct_position_counts(cur)
    item = {**SAMPLES["single_choice"],
            "options": [{"text": t, "is_correct": t == "d4"} for t in ("a1", "b2", "c3", "d4")]}
    assert publicar(content_client, docente, skill_ids[0]["id"], "single_choice", [item]).status_code == 201
    with connect() as conn, conn.cursor() as cur:
        despues = repository.correct_position_counts(cur)
    assert [d - a for d, a in zip(despues, antes)] == [0, 0, 0, 1]


# ---------- HU-04-3: alternativas ----------

def test_el_schema_sigue_aceptando_desde_2_opciones():
    dos = [{"text": "x", "is_correct": True}, {"text": "y", "is_correct": False}]
    validate_items("single_choice", [{**SAMPLES["single_choice"], "options": dos}])


# ---------- Opciones que dependen de otras: solo en la última posición ----------

@pytest.mark.parametrize("texto", ["Todas las anteriores", "Ninguna de las anteriores", "A y B", "Ambas son correctas"])
def test_una_opcion_posicional_en_la_ultima_posicion_se_acepta(content_client, docente, skill_ids, fake_llm, texto):
    fake_llm.respuestas = [_con_opciones(["uno", "dos", "tres", texto], correcta=2)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", correct_position=2, feedback="x")
    assert r.status_code == 200 and len(fake_llm.prompts) == 1


def test_la_opcion_posicional_puede_ser_la_correcta_si_el_objetivo_es_d(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [_con_opciones(["uno", "dos", "tres", "Todas las anteriores"], correcta=4)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", correct_position=4, feedback="x")
    assert r.status_code == 200


def test_una_opcion_posicional_antes_de_la_ultima_se_rechaza_y_se_reintenta(content_client, docente, skill_ids, fake_llm):
    fake_llm.respuestas = [_con_opciones(["uno", "Todas las anteriores", "tres", "cuatro"], correcta=2),
                           llm_answer("single_choice", 1)]
    r = borradores(content_client, docente, skill_ids[0]["id"], "single_choice", correct_position=2, feedback="x")
    assert r.status_code == 200 and "la opción B depende de otras opciones" in fake_llm.prompts[1]


def test_lo_que_edita_el_docente_no_se_limita_por_la_posicion(content_client, docente, skill_ids):
    opciones = [{"text": "uno", "is_correct": True}, {"text": "A y B", "is_correct": False},
                {"text": "tres", "is_correct": False}]
    item = {**SAMPLES["single_choice"], "options": opciones}
    assert publicar(content_client, docente, skill_ids[0]["id"], "single_choice", [item]).status_code == 201


# ---------- HU-04-4: dos pasos en los tipos abiertos ----------

@pytest.mark.parametrize("tipo", ["open_question", "system_design", "debugging"])
def test_los_tipos_abiertos_se_piden_en_dos_pasos(content_client, docente, skill_ids, fake_llm, tipo):
    fake_llm.respuestas = [llm_answer(tipo, 2)]
    r = borradores(content_client, docente, skill_ids[0]["id"], tipo, count=2)
    assert r.status_code == 200 and len(fake_llm.prompts) == 2
    primero, segundo = fake_llm.prompts
    assert "No escribas la respuesta de referencia" in primero and '"reference_answer"' not in primero
    assert "Escribe la respuesta de referencia de cada ítem" in segundo
    assert SAMPLES[tipo]["rubric"][0]["name"] in segundo  # el segundo paso recibe la rúbrica
    assert [d["reference_answer"] for d in r.json()["drafts"]] == ["Referencia de prueba 1", "Referencia de prueba 2"]


def test_si_el_segundo_paso_falla_se_reintenta_y_luego_se_informa(content_client, docente, skill_ids, monkeypatch):
    llamadas = []

    def ask(prompt, authorization):
        llamadas.append(prompt)
        if "Escribe la respuesta de referencia de cada ítem" in prompt:
            return '{"items": [{"reference_answer": ""}]}'
        return json.dumps({"items": [{**SAMPLES["open_question"], "rubric": rubrica_propia()}]})

    monkeypatch.setattr("content.service.ask_llm", ask)
    r = borradores(content_client, docente, skill_ids[0]["id"], "open_question")
    assert r.status_code == 502 and "falta reference_answer" in r.json()["detail"]
    assert len(llamadas) == 3 and "falta reference_answer" in llamadas[2]  # 1.º paso + 2 intentos del 2.º


def test_si_el_primer_paso_trae_una_rubrica_invalida_no_se_pide_el_segundo(content_client, docente, skill_ids, fake_llm):
    mala = {**SAMPLES["open_question"], "rubric": rubrica_propia() + rubrica_propia()[:1]}  # 3 criterios propios
    fake_llm.respuestas = [json.dumps({"items": [mala]}), json.dumps({"items": [mala]})]
    r = borradores(content_client, docente, skill_ids[0]["id"], "open_question")
    assert r.status_code == 502 and len(fake_llm.prompts) == 2
    assert all("Escribe la respuesta de referencia" not in p for p in fake_llm.prompts)


# ---------- HU-04-5 y HU-04-6: rúbrica de 4 criterios con criterios fijos ----------

@pytest.mark.parametrize("tipo", CRITERIOS_FIJOS)
def test_el_prompt_lleva_los_criterios_fijos_del_tipo(content_client, docente, skill_ids, fake_llm, tipo):
    fake_llm.respuestas = [llm_answer(tipo, 1)]
    borradores(content_client, docente, skill_ids[0]["id"], tipo)
    for criterio in CRITERIOS_FIJOS[tipo]:
        assert criterio["name"] in fake_llm.prompts[0]
        assert all(n["descriptor"] in fake_llm.prompts[0] for n in criterio["levels"])  # con sus 4 niveles
    assert "4 criterios de peso 25" in fake_llm.prompts[0] and "NO los escribas" in fake_llm.prompts[0]


@pytest.mark.parametrize("tipo", sorted(OPEN_TYPES))
def test_la_rubrica_generada_lleva_los_criterios_fijos_del_archivo_y_los_2_de_la_ia(content_client, docente, skill_ids,
                                                                                    fake_llm, tipo):
    fake_llm.respuestas = [llm_answer(tipo, 1)]
    rubric = borradores(content_client, docente, skill_ids[0]["id"], tipo).json()["drafts"][0]["rubric"]
    assert rubric[:2] == CRITERIOS_FIJOS[tipo]                    # los fijos, tal cual, primero
    assert [c["name"] for c in rubric[2:]] == [c["name"] for c in rubrica_propia()]
    assert [c["weight"] for c in rubric] == [25, 25, 25, 25]


@pytest.mark.parametrize("cambio", [
    lambda r: r[:1],                                             # 1 criterio propio
    lambda r: r + r[:1],                                         # 3 criterios propios
    lambda r: [{**r[0], "weight": 30}, r[1]],                    # un peso distinto de 25
    lambda r: [{**r[0], "name": "Precisión conceptual"}, r[1]],  # repite un criterio fijo
], ids=["1 criterio", "3 criterios", "peso 30", "repite un fijo"])
def test_si_la_ia_escribe_mal_sus_criterios_se_reintenta_y_luego_se_informa(content_client, docente, skill_ids, fake_llm, cambio):
    mala = json.dumps({"items": [{**SAMPLES["open_question"], "rubric": cambio(rubrica_propia())}]})
    fake_llm.respuestas = [mala, mala]
    r = borradores(content_client, docente, skill_ids[0]["id"], "open_question")
    assert r.status_code == 502 and len(fake_llm.prompts) == 2 and "ítem 1" in r.json()["detail"]


def test_los_criterios_fijos_del_archivo_estan_completos():
    assert set(CRITERIOS_FIJOS) == OPEN_TYPES
    for tipo, criterios in CRITERIOS_FIJOS.items():
        assert len(criterios) == 2 and nombres_fijos(tipo) == [c["name"] for c in criterios]
        for c in criterios:
            assert c["weight"] == PESO_CRITERIO and [n["score"] for n in c["levels"]] == [0, 1, 2, 3]
            assert all(n["descriptor"].strip() for n in c["levels"])


@pytest.mark.parametrize("tipo", CRITERIOS_FIJOS)
def test_una_rubrica_valida_tiene_4_criterios_de_25_con_los_fijos(tipo):
    contenidos = validate_items(tipo, [SAMPLES[tipo]])
    assert [c.weight for c in contenidos[0].rubric] == [25, 25, 25, 25]
    assert all(sorted(lv.score for lv in c.levels) == [0, 1, 2, 3] for c in contenidos[0].rubric)


@pytest.mark.parametrize("cambio,mensaje", [
    (lambda r: r[:3], "at least 4"),                                                           # 3 criterios
    (lambda r: [{**c, "weight": 30 if i == 0 else 25} for i, c in enumerate(r)], "deben sumar 100"),
    (lambda r: [{**r[0], "name": "Otro nombre"}] + r[1:], "criterios fijos"),                  # se renombró un fijo
    (lambda r: r[1:] + [{**r[0], "name": "Extra"}], "criterios fijos"),                        # falta un fijo
    (lambda r: [{**c, "levels": c["levels"][:3]} for c in r], "un descriptor"),                # 3 niveles
])
def test_una_rubrica_que_incumple_la_estructura_se_rechaza(cambio, mensaje):
    item = {**SAMPLES["open_question"], "rubric": cambio(rubrica("open_question"))}
    with pytest.raises(ValueError, match=mensaje):
        validate_items("open_question", [item])


def test_quien_edita_puede_agregar_criterios_si_los_pesos_suman_100():
    rubric = rubrica("open_question")
    for c, peso in zip(rubric, (25, 25, 20, 20)):
        c["weight"] = peso
    rubric.append({**rubrica_propia()[0], "name": "Criterio agregado a mano", "weight": 10})
    contenidos = validate_items("open_question", [{**SAMPLES["open_question"], "rubric": rubric}])
    assert len(contenidos[0].rubric) == 5 and sum(c.weight for c in contenidos[0].rubric) == 100
