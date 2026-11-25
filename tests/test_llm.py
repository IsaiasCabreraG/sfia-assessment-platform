"""Módulo llm: la CLI de Claude y la API de Groq (con respuestas simuladas: ninguna prueba toca la red)."""
import httpx
import pytest


# ---------- CLI ----------

@pytest.fixture
def con_cli(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "cli")


def test_ask_devuelve_la_salida_de_la_cli(llm_client, docente, monkeypatch, con_cli):
    monkeypatch.setenv("LLM_CLI_COMMAND", "cat")  # `cat` devuelve el prompt tal cual
    r = llm_client.post("/ask", json={"prompt": "hola"}, headers=docente["headers"])
    datos = r.json()
    assert r.status_code == 200 and datos["answer"] == "hola"
    # la CLI no informa modelo, tokens ni parámetros: quedan en «--»
    assert datos["provider"] == "cli" and datos["model"] == "--" and isinstance(datos["duration_ms"], int)
    assert datos["usage"] == {"prompt_tokens": "--", "completion_tokens": "--"}
    assert datos["parameters"] == {"temperature": "--", "reasoning_effort": "--", "max_tokens": "--"}


def test_cli_inexistente_es_502(llm_client, docente, monkeypatch, con_cli):
    monkeypatch.setenv("LLM_CLI_COMMAND", "comando-que-no-existe")
    assert llm_client.post("/ask", json={"prompt": "x"}, headers=docente["headers"]).status_code == 502


def test_ask_exige_token(llm_client):
    assert llm_client.post("/ask", json={"prompt": "x"}).status_code == 401


def test_proveedor_desconocido_es_502(llm_client, docente, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "otro")
    r = llm_client.post("/ask", json={"prompt": "x"}, headers=docente["headers"])
    assert r.status_code == 502 and "LLM_PROVIDER desconocido" in r.json()["detail"]


# ---------- Groq ----------

class Respuesta:
    """Reemplaza a httpx.Response: solo lo que usa llm/groq.py."""

    def __init__(self, status=200, cuerpo=None, cabeceras=None):
        self.status_code, self._cuerpo, self.headers = status, cuerpo or {}, cabeceras or {}
        self.text = str(self._cuerpo)

    def json(self):
        return self._cuerpo


def ok(texto="respuesta de la IA", finish="stop"):
    return Respuesta(200, {"choices": [{"message": {"content": texto}, "finish_reason": finish}]})


def error(status, mensaje, cabeceras=None):
    return Respuesta(status, {"error": {"message": mensaje}}, cabeceras)


@pytest.fixture
def groq(monkeypatch):
    """Configura Groq y reemplaza httpx.post y time.sleep. `groq.respuestas` es la cola de respuestas a devolver."""
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("LLM_MODEL", "modelo-de-prueba")
    monkeypatch.setenv("LLM_REASONING_EFFORT", "")

    class Falso:
        respuestas, llamadas, esperas = [], [], []

    Falso.respuestas, Falso.llamadas, Falso.esperas = [], [], []

    def post(url, json, headers, timeout):
        Falso.llamadas.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        r = Falso.respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr("llm.groq.httpx.post", post)
    monkeypatch.setattr("llm.groq.time.sleep", lambda s: Falso.esperas.append(s))
    return Falso


def preguntar(llm_client, docente, prompt="¿hola?"):
    return llm_client.post("/ask", json={"prompt": prompt}, headers=docente["headers"])


def test_groq_envia_el_pedido_con_la_clave_el_modelo_y_el_prompt(llm_client, docente, groq):
    groq.respuestas = [ok("¡hola!")]
    r = preguntar(llm_client, docente, "Dime hola")
    assert r.status_code == 200 and r.json()["answer"] == "¡hola!"
    llamada = groq.llamadas[0]
    assert llamada["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert llamada["headers"]["Authorization"] == "Bearer clave-de-prueba"
    assert llamada["json"]["model"] == "modelo-de-prueba"
    assert llamada["json"]["messages"] == [{"role": "user", "content": "Dime hola"}]
    assert llamada["json"]["max_completion_tokens"] == 4096


def test_groq_sin_clave_explica_que_falta(llm_client, docente, groq, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and "GROQ_API_KEY" in r.json()["detail"] and groq.llamadas == []


def test_groq_clave_rechazada(llm_client, docente, groq):
    groq.respuestas = [error(401, "Invalid API Key")]
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and "rechazó la clave" in r.json()["detail"]


def test_groq_espera_el_retry_after_y_reintenta(llm_client, docente, groq):
    groq.respuestas = [error(429, "límite", {"retry-after": "7"}), ok("ya")]
    r = preguntar(llm_client, docente)
    assert r.status_code == 200 and r.json()["answer"] == "ya"
    assert groq.esperas == [7.0] and len(groq.llamadas) == 2


def test_groq_limita_la_espera_maxima(llm_client, docente, groq):
    groq.respuestas = [error(429, "límite", {"retry-after": "600"}), ok()]
    preguntar(llm_client, docente)
    assert groq.esperas == [30]  # nunca se espera más de ESPERA_MAXIMA


def test_groq_con_limite_agotado_deja_de_reintentar_y_explica(llm_client, docente, groq):
    groq.respuestas = [error(429, "Rate limit reached for model X")] * 3
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and len(groq.llamadas) == 3  # 1 intento + 2 reintentos
    assert "límite de uso gratuito" in r.json()["detail"] and "Rate limit reached" in r.json()["detail"]


def test_groq_respuesta_cortada_por_tokens(llm_client, docente, groq):
    groq.respuestas = [ok('{"items": [', finish="length")]
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and "LLM_MAX_TOKENS" in r.json()["detail"]


def test_groq_respuesta_vacia(llm_client, docente, groq):
    groq.respuestas = [Respuesta(200, {"choices": [{"message": {"content": None}, "finish_reason": "stop"}]})]
    assert preguntar(llm_client, docente).status_code == 502


@pytest.mark.parametrize("fallo,texto", [(httpx.ReadTimeout("t"), "tiempo límite"), (httpx.ConnectError("c"), "No se pudo contactar")])
def test_groq_tiempo_agotado_o_sin_conexion(llm_client, docente, groq, fallo, texto):
    groq.respuestas = [fallo]
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and texto in r.json()["detail"]


def test_groq_otro_error_muestra_el_mensaje_del_servidor(llm_client, docente, groq):
    groq.respuestas = [error(400, "model not found")]
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and "400" in r.json()["detail"] and "model not found" in r.json()["detail"]


def test_la_clave_nunca_aparece_en_los_mensajes_de_error(llm_client, docente, groq):
    groq.respuestas = [error(401, "bad key")]
    assert "clave-de-prueba" not in preguntar(llm_client, docente).text


def test_groq_modelo_inexistente_dice_como_ver_los_disponibles(llm_client, docente, groq):
    groq.respuestas = [error(404, "The model `x` does not exist or you do not have access to it.")]
    r = preguntar(llm_client, docente)
    assert r.status_code == 502 and "modelo-de-prueba" in r.json()["detail"] and "--modelos" in r.json()["detail"]


def test_groq_envia_reasoning_effort_solo_si_esta_configurado(llm_client, docente, groq, monkeypatch):
    groq.respuestas = [ok(), ok()]
    preguntar(llm_client, docente)
    monkeypatch.setenv("LLM_REASONING_EFFORT", "low")
    preguntar(llm_client, docente)
    assert "reasoning_effort" not in groq.llamadas[0]["json"] and groq.llamadas[1]["json"]["reasoning_effort"] == "low"


def test_el_modelo_por_defecto_es_uno_disponible_en_groq(llm_client, docente, groq, monkeypatch):
    monkeypatch.delenv("LLM_MODEL")
    groq.respuestas = [ok()]
    preguntar(llm_client, docente)
    assert groq.llamadas[0]["json"]["model"] == "openai/gpt-oss-120b"


def test_groq_informa_modelo_tokens_y_parametros_de_la_llamada(llm_client, docente, groq, monkeypatch):
    monkeypatch.setenv("LLM_REASONING_EFFORT", "low")
    groq.respuestas = [Respuesta(200, {"model": "modelo-real", "usage": {"prompt_tokens": 12, "completion_tokens": 34},
                                       "choices": [{"message": {"content": "hola"}, "finish_reason": "stop"}]})]
    datos = preguntar(llm_client, docente).json()
    assert datos["provider"] == "groq" and datos["model"] == "modelo-real" and isinstance(datos["duration_ms"], int)
    assert datos["usage"] == {"prompt_tokens": 12, "completion_tokens": 34}
    assert datos["parameters"] == {"temperature": 0.6, "reasoning_effort": "low", "max_tokens": 4096}


def test_groq_sin_tokens_en_su_respuesta_deja_el_dato_en_guiones(llm_client, docente, groq):
    groq.respuestas = [ok("hola")]  # esta respuesta no trae `usage` ni `model`
    datos = preguntar(llm_client, docente).json()
    assert datos["model"] == "modelo-de-prueba" and datos["usage"] == {"prompt_tokens": "--", "completion_tokens": "--"}
