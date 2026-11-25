// Prueba E2E del versionado de ítems en el Portal Docente (HU-13, HU-14, HU-15, HU-26): editar un ítem propio crea
// una versión nueva, regenerar con otro contexto (vista previa y confirmar), historial, copia propia de un ítem ajeno
// y filtro «Solo mis ítems».
// Uso: node versionar.mjs <url-del-portal> <archivo-de-sesiones.json>
import { readFileSync } from "node:fs";
import { chromium } from "/mnt/c/Users/isaia/Repositorios/Tesis/poc/tests/e2e/node_modules/playwright/index.mjs";

const CONTENT = "http://localhost:9004", CATALOG = "http://localhost:9002"; // puertos de run_e2e.sh
const [portal, archivoSesiones] = process.argv.slice(2);
const sesiones = JSON.parse(readFileSync(archivoSesiones, "utf-8"));
const pasos = [];
const paso = (nombre) => { pasos.push(nombre); console.log("✓", nombre); };
const esperar = async (cond, ms = 15000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 200)); } };

/** Llamada directa al backend, para preparar los datos y comprobar lo que quedó guardado. */
async function llamar(sesion, metodo, url, cuerpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${sesion.access}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${metodo} ${url} → ${r.status} ${JSON.stringify(datos)}`);
  return datos;
}

const sufijo = Date.now().toString(36);
const enunciadoPropio = `E2E propio ${sufijo}`, enunciadoAjeno = `E2E ajeno ${sufijo}`, enunciadoCopia = `Copia mía ${sufijo}`;
const skill = (await llamar(sesiones.versionar, "GET", `${CATALOG}/skills`))[0];

async function publicar(sesion, enunciado) {
  const r = await llamar(sesion, "POST", `${CONTENT}/items/publish`, {
    available_to_experts: true,
    groups: [{ skill_id: skill.id, level: 3, item_type: "single_choice", estimated_minutes: 10, context: null, items: [{
      statement: enunciado, evaluation_goal: "Objetivo E2E",
      options: [{ text: "A", is_correct: false }, { text: "B", is_correct: true }, { text: "C", is_correct: false }],
    }] }],
  });
  return r.items[0].id;
}
const idPropio = await publicar(sesiones.versionar, enunciadoPropio);
const idAjeno = await publicar(sesiones.versionar_ajeno, enunciadoAjeno);
await llamar(sesiones.versionar_validador, "PUT", `${CONTENT}/items/${idPropio}/score`, { score: 4 });

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript((s) => { localStorage.setItem("sprint1_token_docente", s.access); localStorage.setItem("sprint1_refresh_docente", s.refresh); }, sesiones.versionar);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

const cabecera = () => page.locator("article.detalle header .suave");
const filas = (texto) => page.locator("section.lista button.fila", { hasText: texto });

try {
  await page.goto(`${portal}/docente/`);
  await page.getByRole("button", { name: "Banco de ítems" }).click();
  await filas(enunciadoPropio).first().click();
  for (const boton of ["Editar", "Regenerar con otro contexto", "Historial"])
    await page.getByRole("button", { name: boton, exact: true }).waitFor();
  paso("[banco] el detalle de un ítem ofrece editar, regenerar con otro contexto e historial");

  // HU-13 y HU-26: editar un ítem propio crea la versión 2
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Enunciado").fill(`${enunciadoPropio} editado`);
  await page.getByRole("button", { name: "Guardar como versión nueva" }).click();
  await page.getByText("Se guardó la versión 2.").waitFor();
  await esperar(async () => /versión 2/.test(await cabecera().innerText()));
  paso("[HU-13, HU-26] editar un ítem propio guarda la versión 2 y el detalle la muestra");

  // HU-26: el historial conserva la versión 1 con su puntuación; la nueva parte sin puntuar
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.locator("table.historial tbody tr").first().waitFor();
  const v = await page.locator("table.historial tbody tr").allInnerTexts();
  if (v.length !== 2 || !/2\s+editada.*sin puntuar/s.test(v[0]) || !/1\s+generada.*4\.0 \(1\)/s.test(v[1]))
    throw new Error("historial inesperado: " + JSON.stringify(v));
  paso("[HU-26] el historial muestra la versión 2 sin puntuar y la 1 con su puntuación (4.0)");

  // HU-14: regenerar con otro contexto, con vista previa antes de guardar
  await page.getByRole("button", { name: "Regenerar con otro contexto" }).click();
  const generar = page.getByRole("button", { name: "Generar vista previa" });
  if (!(await generar.isDisabled())) throw new Error("sin contexto no se puede generar la vista previa");
  await page.getByLabel(/Nuevo contexto/).fill("Un banco chileno");
  await generar.click();
  await page.getByRole("button", { name: "Guardar como versión nueva" }).waitFor();
  if (await page.getByText("Se guardó la versión 3.").count()) throw new Error("la vista previa no debe guardar nada");
  paso("[HU-14] la vista previa de la regeneración no guarda nada hasta confirmar");
  await page.getByRole("button", { name: "Guardar como versión nueva" }).click();
  await page.getByText("Se guardó la versión 3.").waitFor();
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.locator("table.historial tbody tr").nth(2).waitFor();
  const regen = await page.locator("table.historial tbody tr").first().innerText();
  if (!/3\s+regenerada/s.test(regen)) throw new Error("la versión 3 debe figurar como regenerada: " + regen);
  paso("[HU-14, HU-26] confirmar la vista previa guarda la versión 3 con origen «regenerada»");

  // HU-15: editar un ítem ajeno crea una copia propia y privada; el original no cambia
  await filas(enunciadoAjeno).first().click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.locator(".aviso", { hasText: "otro docente" }).waitFor();
  if (await page.getByLabel(/Disponible para expertos/).isChecked()) throw new Error("la copia de un ítem ajeno parte privada");
  await page.getByLabel("Enunciado").fill(enunciadoCopia);
  await page.getByRole("button", { name: "Guardar como copia mía" }).click();
  await esperar(async () => /copia de otro ítem/.test(await cabecera().innerText()));
  if (!/uso privado/.test(await cabecera().innerText())) throw new Error("la copia debe ser de uso privado");
  paso("[HU-15] editar un ítem ajeno avisa, guarda una copia propia privada y la abre");
  const original = await llamar(sesiones.versionar_ajeno, "GET", `${CONTENT}/items/${idAjeno}`);
  if (original.version !== 1 || original.statement !== enunciadoAjeno) throw new Error("el original no debe cambiar");
  paso("[HU-15] el ítem original del otro docente queda intacto (versión 1)");

  // HU-15: «Solo mis ítems»
  await page.getByLabel("Solo mis ítems").check();
  await esperar(async () => (await filas(enunciadoAjeno).count()) === 0);
  await filas(enunciadoCopia).first().waitFor();
  paso("[HU-15] «Solo mis ítems» oculta los ítems de otros y muestra la copia propia");

  if (errores.length) throw new Error("errores en la consola: " + errores.join(" | "));
  console.log(`\nOK: ${pasos.length} comprobaciones`);
} catch (e) {
  console.error("\nFALLÓ después de:", pasos.at(-1) ?? "(nada)");
  console.error(e.message);
  await page.screenshot({ path: "/tmp/e2e-fallo.png", fullPage: true });
  console.error("captura en /tmp/e2e-fallo.png");
  process.exitCode = 1;
} finally {
  await browser.close();
}
