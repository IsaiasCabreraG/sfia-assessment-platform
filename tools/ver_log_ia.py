"""Genera un visor HTML (de solo lectura) con los registros del log de IA de desarrollo (`logs/ia/*.jsonl`).

    bash tools/run_python.sh tools/ver_log_ia.py            # escribe logs/ia/visor.html y muestra su ruta
    bash tools/run_python.sh tools/ver_log_ia.py --carpeta otra/carpeta

El log lo escribe `content/generation/ai_log.py` cuando `LOG_IA=1`. El visor permite filtrar por etiqueta, modelo, tipo,
paso y validez, abrir cada intento (prompt, respuesta, errores y datos de la llamada) y comparar, para el mismo caso,
lo que respondió cada modelo. Solo usa la biblioteca estándar.
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

PLANTILLA = """<!doctype html>
<html lang="es"><meta charset="utf-8"><title>Log de IA</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #1c2430; background: #f5f6f8; }
  header { padding: .8rem 1rem; background: #fff; border-bottom: 1px solid #d5d9e0; position: sticky; top: 0; z-index: 2; }
  h1 { font-size: 1.05rem; margin: 0 0 .5rem; }
  .filtros { display: flex; flex-wrap: wrap; gap: .6rem; font-size: .85rem; }
  .filtros label { display: flex; flex-direction: column; gap: .15rem; }
  select { padding: .25rem; }
  main { display: grid; grid-template-columns: minmax(420px, 1fr) 1.4fr; gap: 1rem; padding: 1rem; align-items: start; }
  .tabla { overflow-x: auto; min-width: 0; }
  table { border-collapse: collapse; width: 100%; background: #fff; font-size: .8rem; }
  th, td { border-bottom: 1px solid #e6e9ee; padding: .3rem .45rem; text-align: left; white-space: nowrap; }
  tr.fila { cursor: pointer; } tr.fila:hover { background: #f0f4fb; } tr.activa { background: #dfeafb; }
  .ok { color: #1b7a3a; font-weight: 700; } .mal { color: #b3261e; font-weight: 700; }
  .panel { background: #fff; border: 1px solid #d5d9e0; border-radius: 8px; padding: .8rem 1rem; }
  .panel h2 { margin: 0 0 .5rem; font-size: 1rem; } .panel h3 { margin: .8rem 0 .2rem; font-size: .8rem; text-transform: uppercase; color: #66707d; }
  pre { background: #f0f2f5; padding: .6rem; border-radius: 6px; white-space: pre-wrap; word-break: break-word; max-height: 28rem; overflow: auto; font-size: .78rem; }
  .meta { display: grid; grid-template-columns: auto 1fr; gap: .15rem .8rem; font-size: .82rem; }
  .meta dt { color: #66707d; } .meta dd { margin: 0; }
  .comparar { display: grid; gap: .6rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .comparar > div { border: 1px solid #d5d9e0; border-radius: 6px; padding: .4rem .6rem; }
  .suave { color: #66707d; font-size: .85rem; }
</style>
<header>
  <h1>Log de IA (solo desarrollo) · <span id="total"></span></h1>
  <div class="filtros" id="filtros"></div>
</header>
<main>
  <div class="tabla"><table><thead><tr><th>Fecha</th><th>Etiqueta</th><th>Tipo</th><th>Skill</th><th>Paso</th><th>Int.</th><th>Modelo</th><th>Válido</th><th>ms</th><th>Tokens</th></tr></thead><tbody id="filas"></tbody></table></div>
  <section class="panel" id="detalle"><p class="suave">Elige un intento de la tabla para ver su prompt y su respuesta.</p></section>
</main>
<script id="datos" type="application/json">__DATOS__</script>
<script>
const registros = JSON.parse(document.getElementById("datos").textContent);
const CAMPOS = [["etiqueta", "Etiqueta"], ["modelo", "Modelo"], ["tipo", "Tipo"], ["paso", "Paso"], ["valido", "Válido"]];
const filtros = {};
const unicos = (campo) => [...new Set(registros.map((r) => String(r[campo])))].sort();
const caso = (r) => [r.skill, r.nivel, r.tipo, r.cantidad, r.paso, r.version_prompt].join("|");
const tokens = (r) => (r.tokens && typeof r.tokens === "object" ? `${r.tokens.prompt_tokens}+${r.tokens.completion_tokens}` : "--");
const esc = (t) => String(t ?? "--").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

document.getElementById("filtros").innerHTML = CAMPOS.map(([c, t]) =>
  `<label>${t}<select data-campo="${c}"><option value="">Todos</option>${unicos(c).map((v) => `<option>${esc(v)}</option>`).join("")}</select></label>`).join("");
document.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { filtros[s.dataset.campo] = s.value; pintar(); }));

let seleccion = null;
function visibles() { return registros.filter((r) => CAMPOS.every(([c]) => !filtros[c] || String(r[c]) === filtros[c])); }
function pintar() {
  const lista = visibles();
  document.getElementById("total").textContent = `${lista.length} de ${registros.length} intentos`;
  document.getElementById("filas").innerHTML = lista.map((r) => {
    const i = registros.indexOf(r);
    return `<tr class="fila ${i === seleccion ? "activa" : ""}" data-i="${i}"><td>${esc(r.fecha)}</td><td>${esc(r.etiqueta)}</td><td>${esc(r.tipo)}</td><td>${esc(r.skill)}</td><td>${esc(r.paso)}</td><td>${esc(r.intento)}</td><td>${esc(r.modelo)}</td><td class="${r.valido ? "ok" : "mal"}">${r.valido ? "sí" : "no"}</td><td>${esc(r.duracion_ms)}</td><td>${tokens(r)}</td></tr>`;
  }).join("");
  document.querySelectorAll("tr.fila").forEach((f) => f.addEventListener("click", () => { seleccion = Number(f.dataset.i); pintar(); detalle(); }));
}
function detalle() {
  const r = registros[seleccion];
  const iguales = registros.filter((x) => caso(x) === caso(r) && x !== r);
  const meta = [["Fecha", r.fecha], ["Etiqueta", r.etiqueta], ["Pedido", r.pedido], ["Proveedor", r.proveedor], ["Modelo", r.modelo], ["Parámetros", JSON.stringify(r.parametros)],
    ["Tokens", JSON.stringify(r.tokens)], ["Duración (ms)", r.duracion_ms], ["Prompt", `v${r.version_prompt} · ${r.huella_prompt}`], ["Caso", `${r.cantidad}× ${r.tipo}, skill ${r.skill}, nivel ${r.nivel}, ${r.minutos} min`],
    ["Objetivos", JSON.stringify(r.objetivos)]];
  document.getElementById("detalle").innerHTML = `
    <h2>${esc(r.tipo)} · ${esc(r.skill)} · ${esc(r.paso)} · intento ${esc(r.intento)} <span class="${r.valido ? "ok" : "mal"}">${r.valido ? "válido" : "rechazado"}</span></h2>
    <dl class="meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${r.errores ? `<h3>Por qué se rechazó</h3><pre>${esc(r.errores)}</pre>` : ""}
    <h3>Respuesta de la IA</h3><pre>${esc(r.respuesta)}</pre>
    <h3>Prompt enviado</h3><pre>${esc(r.prompt)}</pre>
    <h3>Mismo caso en otros intentos (${iguales.length})</h3>
    ${iguales.length === 0 ? '<p class="suave">No hay otros intentos con el mismo caso (skill, nivel, tipo, cantidad, paso y versión del prompt).</p>' :
      `<div class="comparar">${iguales.map((x) => `<div><strong>${esc(x.modelo)}</strong> · ${esc(x.etiqueta)} · intento ${esc(x.intento)} · <span class="${x.valido ? "ok" : "mal"}">${x.valido ? "válido" : "rechazado"}</span><pre>${esc(x.respuesta)}</pre></div>`).join("")}</div>`}`;
}
pintar();
</script></html>
"""


def leer(carpeta: Path) -> list[dict]:
    registros = []
    for archivo in sorted(carpeta.glob("*.jsonl")):
        for n, linea in enumerate(archivo.read_text(encoding="utf-8").splitlines(), start=1):
            if not linea.strip():
                continue
            try:
                registros.append(json.loads(linea))
            except json.JSONDecodeError:
                print(f"aviso: línea {n} de {archivo.name} no es JSON válido; se omite", file=sys.stderr)
    return registros


def main() -> int:
    carpeta = Path(sys.argv[sys.argv.index("--carpeta") + 1]) if "--carpeta" in sys.argv else RAIZ / "logs" / "ia"
    registros = leer(carpeta)
    if not registros:
        print(f"No hay registros en {carpeta}. Activa el log con LOG_IA=1 en el .env y genera ítems.")
        return 1
    destino = carpeta / "visor.html"
    # "</" se escapa para que un texto con "</script>" no cierre la etiqueta del visor
    datos = json.dumps(registros, ensure_ascii=False).replace("</", "<\\/")
    destino.write_text(PLANTILLA.replace("__DATOS__", datos), encoding="utf-8")
    print(f"{len(registros)} intentos → {destino}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
