"""Log de las llamadas a la IA (solo desarrollo): apagado por defecto, una línea por intento y sin romper la generación."""
import json

import pytest

from content.generation.llm_client import TextoIA
from content.generation.prompts import PROMPT
from tests.helpers import borradores
from tests.samples import llm_answer


@pytest.fixture
def log_ia(tmp_path, monkeypatch):
    """Activa el log en una carpeta temporal. Devuelve una función que lee las líneas escritas."""
    monkeypatch.setenv("LOG_IA", "1")
    monkeypatch.setenv("LOG_IA_DIR", str(tmp_path))
    monkeypatch.setenv("LOG_IA_ETIQUETA", "prueba-modelos")

    def lineas() -> list[dict]:
        return [json.loads(l) for f in sorted(tmp_path.glob("*.jsonl")) for l in f.read_text(encoding="utf-8").splitlines()]
    return lineas


def test_por_defecto_el_log_esta_apagado(content_client, docente, skill_ids, fake_llm, tmp_path, monkeypatch):
    monkeypatch.delenv("LOG_IA", raising=False)
    monkeypatch.setenv("LOG_IA_DIR", str(tmp_path))
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    assert borradores(content_client, docente, skill_ids[0]["id"], "true_false").status_code == 200
    assert list(tmp_path.glob("*")) == []


def test_cada_intento_deja_una_linea_con_el_prompt_la_respuesta_y_la_version(content_client, docente, skill_ids, fake_llm, log_ia):
    fake_llm.respuestas = [llm_answer("true_false", 2)]
    borradores(content_client, docente, skill_ids[0]["id"], "true_false", count=2, level=4)
    (linea,) = log_ia()
    assert linea["etiqueta"] == "prueba-modelos" and linea["tipo"] == "true_false" and linea["cantidad"] == 2 and linea["nivel"] == 4
    assert linea["skill"] == skill_ids[0]["code"] and linea["paso"] == "completo" and linea["intento"] == 1
    assert "Genera 2" in linea["prompt"] and linea["respuesta"].startswith("{") and linea["valido"] is True and linea["errores"] is None
    assert linea["version_prompt"] == PROMPT["version"] and len(linea["huella_prompt"]) == 10 and len(linea["pedido"]) == 8
    assert len(linea["objetivos"]) == 2


def test_un_reintento_queda_registrado_con_su_error(content_client, docente, skill_ids, fake_llm, log_ia):
    fake_llm.respuestas = ["esto no es json", llm_answer("true_false", 1)]
    borradores(content_client, docente, skill_ids[0]["id"], "true_false")
    primera, segunda = log_ia()
    assert (primera["intento"], primera["valido"], segunda["intento"], segunda["valido"]) == (1, False, 2, True)
    assert "JSON" in primera["errores"] and primera["respuesta"] == "esto no es json"
    assert "rechazada" in segunda["prompt"] and primera["pedido"] == segunda["pedido"]


def test_los_tipos_abiertos_registran_cada_paso(content_client, docente, skill_ids, fake_llm, log_ia):
    fake_llm.respuestas = [llm_answer("open_question", 1)]
    borradores(content_client, docente, skill_ids[0]["id"], "open_question")
    assert [l["paso"] for l in log_ia()] == ["items", "referencias"]


def test_los_datos_de_la_llamada_vienen_del_modulo_llm_y_si_faltan_van_en_guiones(content_client, docente, skill_ids, monkeypatch, log_ia):
    import json as _json
    from tests.samples import respuesta_desde_prompt

    def ask(prompt, authorization):
        texto = TextoIA(respuesta_desde_prompt(prompt, "true_false", 1))
        texto.meta = {"provider": "groq", "model": "modelo-x", "duration_ms": 1234,
                      "usage": {"prompt_tokens": 10, "completion_tokens": 20}, "parameters": {"temperature": 0.6, "reasoning_effort": "low", "max_tokens": 4096}}
        return texto

    monkeypatch.setattr("content.service.ask_llm", ask)
    borradores(content_client, docente, skill_ids[0]["id"], "true_false")
    monkeypatch.setattr("content.service.ask_llm", lambda prompt, authorization: respuesta_desde_prompt(prompt, "true_false", 1))  # un str sin datos
    borradores(content_client, docente, skill_ids[0]["id"], "true_false")
    con_datos, sin_datos = log_ia()
    assert (con_datos["proveedor"], con_datos["modelo"], con_datos["duracion_ms"]) == ("groq", "modelo-x", 1234)
    assert con_datos["tokens"] == {"prompt_tokens": 10, "completion_tokens": 20} and con_datos["parametros"]["temperature"] == 0.6
    assert (sin_datos["proveedor"], sin_datos["modelo"], sin_datos["tokens"], sin_datos["duracion_ms"]) == ("--", "--", "--", "--")


def test_el_log_no_guarda_el_token_del_usuario(content_client, docente, skill_ids, fake_llm, log_ia, tmp_path):
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    borradores(content_client, docente, skill_ids[0]["id"], "true_false")
    contenido = "".join(f.read_text(encoding="utf-8") for f in tmp_path.glob("*.jsonl"))
    assert "Bearer" not in contenido and docente["headers"]["Authorization"].split()[-1] not in contenido


def test_si_no_se_puede_escribir_el_log_la_generacion_sigue(content_client, docente, skill_ids, fake_llm, monkeypatch, tmp_path):
    archivo = tmp_path / "no-es-una-carpeta"
    archivo.write_text("x")
    monkeypatch.setenv("LOG_IA", "1")
    monkeypatch.setenv("LOG_IA_DIR", str(archivo))
    fake_llm.respuestas = [llm_answer("true_false", 1)]
    assert borradores(content_client, docente, skill_ids[0]["id"], "true_false").status_code == 200
