// Prueba E2E del Constructor de evaluaciones en el Portal Docente (HU-11, HU-12, HU-38). Crece con cada entrega.
// Entrega 4a: listado de evaluaciones y paso 1 (reglas): skills con niveles propios, roles, rol personalizado,
// rol propio y plantillas.
// Entrega 4b: paso 2 (ítems): banco que solo ofrece lo que cumple las reglas, orden con dnd-kit y ficha
// de la versión fijada.
// Entrega 4c: paso 3 (publicación), evaluación publicada en solo lectura, guardar como plantilla, pestañas Plantillas y
// Mis roles, y el aviso al desactivar un ítem usado.
// Uso: node constructor.mjs <url-del-portal> <archivo-de-sesiones.json>
import { readFileSync } from "node:fs";
import { chromium } from "/mnt/c/Users/isaia/Repositorios/Tesis/poc/tests/e2e/node_modules/playwright/index.mjs";

/** Responde al diálogo «Confirmar» del portal (ya no se usa window.confirm) y devuelve su mensaje. */
async function confirmar(page, aceptar = true) {
  const d = page.getByRole("dialog", { name: "Confirmar" });
  await d.waitFor();
  const mensaje = await d.locator("p").innerText();
  await d.getByRole("button", { name: aceptar ? "Aceptar" : "Cancelar" }).click();
  await d.waitFor({ state: "detached" });
  return mensaje;
}

const BUILDER = "http://localhost:9005", CATALOG = "http://localhost:9002", CONTENT = "http://localhost:9004"; // puertos de run_e2e.sh
const [portal, archivoSesiones] = process.argv.slice(2);
const sesiones = JSON.parse(readFileSync(archivoSesiones, "utf-8"));
const sesion = sesiones.constructor_docente;
const pasos = [];
const paso = (nombre) => { pasos.push(nombre); console.log("✓", nombre); };
const esperar = async (cond, ms = 15000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 200)); } };

/** Llamada directa al backend, para preparar datos y comprobar lo que quedó guardado. */
async function llamar(metodo, url, cuerpo) {
  const r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${sesion.access}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${metodo} ${url} → ${r.status} ${JSON.stringify(datos)}`);
  return datos;
}

const sufijo = Date.now().toString(36);
const nombreEvaluacion = `Constructor E2E ${sufijo}`, nombreRolPropio = `Rol propio E2E ${sufijo}`;
const catalogo = await llamar("GET", `${CATALOG}/skills`);
const sfia = (codigo) => catalogo.find((s) => s.code === codigo);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript((s) => { localStorage.setItem("sfia_token_docente", s.access); localStorage.setItem("sfia_refresh_docente", s.refresh); }, sesion);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

const botonExacto = (nombre) => page.getByRole("button", { name: nombre, exact: true });
const filasSkill = () => page.locator(".skill-eval");
const filaSkill = (codigo) => page.locator(".skill-eval", { has: page.locator(".skill-codigo", { hasText: new RegExp(`^${codigo}$`) }) });
/** Abre «Añadir una skill», busca por código y elige la skill. */
async function anadirSkill(codigo) {
  await botonExacto("Añadir una skill").click();
  await page.getByLabel("Buscar skill").fill(codigo);
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: new RegExp(`^${codigo}$`) }) }).first().click();
}

try {
  await page.goto(`${portal}/docente/`);
  await botonExacto("Constructor").click();
  await page.getByRole("heading", { name: "Mis evaluaciones" }).waitFor();
  await page.getByText("No hay evaluaciones en borrador.").waitFor();
  paso("[constructor] la pestaña abre «Mis evaluaciones», vacía para un docente nuevo");

  // Paso 1: una evaluación nueva con skills, cada una con sus propios niveles
  await botonExacto("+ Nueva evaluación").click();
  await page.getByRole("heading", { name: "Nueva evaluación" }).waitFor();
  for (const texto of ["Ítems", "Publicación"]) await page.locator(".paso-item", { hasText: texto }).waitFor();
  await page.getByLabel("Nombre de la evaluación").fill(nombreEvaluacion);
  await anadirSkill("PROG");
  const prog = sfia("PROG");
  const rangoEnPantalla = async (codigo) => {
    const marcados = await page.getByRole("group", { name: `Niveles de ${codigo}` }).locator("button[aria-pressed=true]").evaluateAll((bs) => bs.map((b) => Number(b.dataset.nivel)));
    return [Math.min(...marcados), Math.max(...marcados)];
  };
  const [minPantalla, maxPantalla] = await rangoEnPantalla("PROG");
  if (minPantalla !== prog.min_level || maxPantalla !== prog.max_level) throw new Error("la skill debe partir del rango que SFIA define para ella");
  const nuevoMin = Math.min(prog.min_level + 1, prog.max_level);
  const grupo = page.getByRole("group", { name: "Niveles de PROG" });
  await grupo.getByRole("button", { name: "Nivel 7", exact: true }).click();   // un nivel y luego otro eligen el rango (se puede salir del rango SFIA)
  await grupo.getByRole("button", { name: `Nivel ${nuevoMin}`, exact: true }).click();
  const [lo, hi] = await rangoEnPantalla("PROG");
  if (lo !== nuevoMin || hi !== 7) throw new Error(`el rango elegido es ${lo}-${hi}, se esperaba ${nuevoMin}-7`);
  if (prog.max_level < 7) await filaSkill("PROG").getByText("fuera del rango SFIA").waitFor();
  // Al pasar el cursor, la skill se expande con su descripción y lo que significa cada nivel
  await filaSkill("PROG").hover();
  await esperar(async () => !(await filaSkill("PROG").locator(".ficha-skill").innerText()).includes("Cargando la descripción"));
  await esperar(async () => (await filaSkill("PROG").locator(".ficha-niveles li").count()) === prog.max_level - prog.min_level + 1);
  paso("[HU-11-2] al pasar el cursor, la skill muestra su descripción y sus niveles");
  paso("[HU-11-2] cada skill muestra sus niveles como cuadritos (por defecto los de SFIA), editables por skill");

  // Skills de un rol: core y related solo se ven en la ventana; el rol queda como base y al cambiar las skills es personalizado
  await page.getByRole("button", { name: "Añadir desde un rol", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Añadir skills de un rol" });
  await dialogo.getByLabel("Buscar rol").fill("Accessibility practitioners");
  await dialogo.locator("button.rol-opcion", { hasText: "Accessibility practitioners" }).click();
  await dialogo.getByRole("heading", { name: /^Skills core/ }).waitFor();
  await dialogo.getByRole("heading", { name: /^Skills related/ }).waitFor();
  await dialogo.locator(".rol-grupo").nth(0).locator(".skill-tarjeta").first().click();
  await dialogo.getByRole("button", { name: "Añadir 1 skill" }).click();
  await esperar(async () => (await filasSkill().count()) === 2);
  await page.getByText("Rol de base:").waitFor();
  await page.getByText("rol personalizado").waitFor();
  if (await page.locator(".skill-eval", { hasText: /core|related/i }).count()) throw new Error("la evaluación no distingue core y related");
  paso("[HU-11-3] core y related solo se ven al elegir desde el rol; el rol queda de base y pasa a ser personalizado");

  // Guardar el rol personalizado como rol propio (HU-38) y la evaluación
  await botonExacto("Guardar como rol propio").click();
  await page.getByLabel("Nombre del rol propio").fill(nombreRolPropio);
  await botonExacto("Guardar rol").click();
  await page.getByText(`Rol propio «${nombreRolPropio}» guardado.`).waitFor();
  paso("[HU-38] el rol personalizado se puede guardar como rol propio, sin guardarse solo");
  await botonExacto("Guardar").click();
  await page.getByText("Guardado.").waitFor();
  const guardada = (await llamar("GET", `${BUILDER}/evaluations?status=draft`)).find((e) => e.name === nombreEvaluacion);
  const detalle = await llamar("GET", `${BUILDER}/evaluations/${guardada.id}`);
  const rangoProg = detalle.skills.find((s) => s.code === "PROG");
  if (rangoProg.min_level !== nuevoMin || detalle.skills.length !== 2 || !detalle.role_customized) throw new Error("lo guardado no coincide: " + JSON.stringify(detalle.skills));
  paso("[HU-11] guardar crea el borrador con las skills y los niveles de cada una");

  // Listado: continuar recupera lo guardado
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  const fila = page.locator("li.fila-evaluacion", { hasText: nombreEvaluacion });
  await fila.waitFor();
  if ((await fila.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length)) !== 6) throw new Error("los atributos de la evaluación deben ir en columnas");
  await page.locator(".cabecera-eval").waitFor();
  // los títulos de las columnas quedan sobre sus datos y las acciones son iconos (sin texto)
  for (const i of [0, 1, 2, 3]) {
    const xTitulo = (await page.locator(".cabecera-eval > span").nth(i + 1).boundingBox()).x, xDato = (await fila.locator(":scope > span").nth(i).boundingBox()).x;
    if (Math.abs(xTitulo - xDato) > 2) throw new Error(`el título de la columna ${i + 1} está desplazado (${xTitulo} ≠ ${xDato})`);
  }
  if ((await fila.getByRole("button", { name: "Continuar" }).innerText()).trim() !== "") throw new Error("«Continuar» debe ser un icono, sin texto");
  await fila.getByRole("button", { name: "Continuar" }).click();
  await esperar(async () => (await filasSkill().count()) === 2);
  if ((await rangoEnPantalla("PROG"))[0] !== nuevoMin) throw new Error("el nivel guardado no se recuperó");
  await page.getByText("Rol de base:").waitFor();
  paso("[constructor] continuar un borrador recupera sus skills, sus niveles y su rol de base");

  // Duplicar y descartar
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await fila.getByRole("button", { name: "Duplicar" }).click();
  await esperar(async () => (await page.getByLabel("Nombre de la evaluación").inputValue()) === `${nombreEvaluacion} (copia)`);
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  const copia = page.locator("li.fila-evaluacion", { hasText: `${nombreEvaluacion} (copia)` });
  await copia.waitFor();
  await copia.getByRole("button", { name: "Descartar" }).click();
  await confirmar(page);
  await esperar(async () => (await copia.count()) === 0);
  await botonExacto("Descartadas").click();
  await page.locator("li.fila-evaluacion", { hasText: `${nombreEvaluacion} (copia)` }).waitFor();
  await botonExacto("Borradores").click();
  paso("[HU-12-3] duplicar abre una copia en borrador; descartar la saca de los borradores y la deja en «Descartadas»");

  // Partir de una plantilla y de un rol propio
  await llamar("POST", `${BUILDER}/evaluations/${guardada.id}/template`, { name: `Plantilla E2E ${sufijo}`, visibility: "private" });
  await botonExacto("+ Nueva evaluación").click();
  await botonExacto("Partir de una plantilla…").click();
  await page.getByRole("dialog", { name: "Partir de una plantilla" }).locator("button.rol-opcion", { hasText: `Plantilla E2E ${sufijo}` }).click();
  await esperar(async () => (await page.getByLabel("Nombre de la evaluación").inputValue()) === `Plantilla E2E ${sufijo}`);
  await esperar(async () => (await filasSkill().count()) === 2);
  paso("[HU-12] «Partir de una plantilla» crea un borrador con las skills y los niveles de la plantilla");
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await botonExacto("+ Nueva evaluación").click();
  await page.getByRole("button", { name: "Añadir desde un rol propio" }).click();
  await page.getByRole("dialog", { name: "Añadir skills de un rol propio" }).locator("button.rol-opcion", { hasText: nombreRolPropio }).click();
  await esperar(async () => (await filasSkill().count()) === 2);
  paso("[HU-38] las skills de un rol propio se añaden a la evaluación");

  // ---------- Entrega 4b: paso 2, ítems ----------
  const publicar = async (texto, skillId, nivel, disponible = true) => {
    const r = await llamar("POST", `${CONTENT}/items/publish`, { available_to_experts: disponible, groups: [{
      skill_id: skillId, level: nivel, item_type: "single_choice", estimated_minutes: 10, context: null,
      items: [{ statement: texto, evaluation_goal: "Objetivo E2E", options: [
        { text: "A", is_correct: false }, { text: "B", is_correct: true }, { text: "C", is_correct: false }] }] }] });
    return { id: r.items[0].id, version: r.items[0].version_id };
  };
  const otraSkill = sfia("ACIN");
  const itemEnRango = await publicar(`4b en rango ${sufijo}`, prog.id, 3);
  const itemFuera = await publicar(`4b fuera ${sufijo}`, prog.id, 6);
  const itemNuevo = await publicar(`4b skill nueva ${sufijo}`, otraSkill.id, 3);
  const itemExcluido = await publicar(`4b excluido ${sufijo}`, prog.id, 2);   // nivel fuera de las reglas (PROG 3 a 6)
  const evPaso2 = await llamar("POST", `${BUILDER}/evaluations`, { name: `Paso 2 E2E ${sufijo}`, skills: [
    { skill_id: prog.id, min_level: 3, max_level: 6 }, { skill_id: otraSkill.id, min_level: 3, max_level: 3 }] });
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await page.locator("li.fila-evaluacion", { hasText: `Paso 2 E2E ${sufijo}` }).getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Ítems/ }).click();
  const banco = () => page.locator(".fila-banco-contenedor");
  const enEvaluacion = () => page.locator(".fila-eval-contenedor");
  await page.getByLabel("Buscar ítems").fill(sufijo);
  await esperar(async () => (await banco().count()) === 3);
  if (await banco().filter({ hasText: `4b excluido ${sufijo}` }).count()) throw new Error("el banco no debe ofrecer ítems fuera de las reglas");
  paso("[HU-11] el banco solo ofrece los ítems que cumplen las reglas (skills y niveles de cada una)");

  // Ordenar por nivel (mayor a menor): el de nivel 6 va primero
  await page.getByLabel("Ordenar por").selectOption("level_desc");
  await esperar(async () => /4b fuera/.test(await banco().first().innerText()));
  paso("[HU-11] el banco se puede ordenar (aquí por nivel, de mayor a menor)");

  for (const texto of ["en rango", "fuera", "skill nueva"]) {
    await banco().filter({ hasText: `4b ${texto} ${sufijo}` }).getByRole("button", { name: "Agregar" }).click();
    await esperar(async () => (await banco().filter({ hasText: `4b ${texto} ${sufijo}` }).getByRole("button", { name: "Quitar de la evaluación" }).count()) === 1);   // el «+» pasa a «−»
  }
  await esperar(async () => (await enEvaluacion().count()) === 3);
  const rangoNuevo = (await llamar("GET", `${BUILDER}/evaluations/${evPaso2.id}`)).skills.find((s) => s.code === "PROG");
  if (rangoNuevo.min_level !== 3 || rangoNuevo.max_level !== 6) throw new Error("agregar ítems no debe cambiar las reglas: " + JSON.stringify(rangoNuevo));
  paso("[HU-11] agregar un ítem lo suma a la evaluación sin pedir confirmaciones ni cambiar las reglas");
  await page.getByText("30 min").waitFor();

  // Orden con dnd-kit (con el teclado): el tercer ítem sube al primer lugar
  const ordenApi = async () => (await llamar("GET", `${BUILDER}/evaluations/${evPaso2.id}`)).items.map((i) => i.item_id);
  await page.getByRole("button", { name: "Mover el ítem 3" }).focus();
  for (const tecla of ["Space", "ArrowUp", "ArrowUp", "Space"]) { await page.keyboard.press(tecla); await page.waitForTimeout(250); }  // dnd-kit procesa cada tecla de forma asíncrona
  await esperar(async () => (await ordenApi())[0] === itemNuevo.id);
  await enEvaluacion().first().getByText(`4b skill nueva ${sufijo}`).waitFor();
  paso("[HU-11] los ítems se ordenan arrastrándolos (dnd-kit, también con el teclado) y el orden queda guardado");

  // La ficha muestra la versión fijada, aunque el ítem tenga una versión más nueva
  await llamar("PUT", `${CONTENT}/items/${itemEnRango.id}`, { item: { statement: `4b en rango ${sufijo} EDITADO`, evaluation_goal: "Objetivo E2E",
    options: [{ text: "A", is_correct: false }, { text: "B", is_correct: true }, { text: "C", is_correct: false }] }, estimated_minutes: 10, available_to_experts: true });
  await enEvaluacion().filter({ hasText: `4b en rango ${sufijo}` }).locator(".enunciado").click();
  const ficha = page.getByRole("dialog", { name: "Ficha del ítem" });
  await ficha.getByRole("button", { name: "Cerrar" }).waitFor();
  for (const accion of ["Editar", "Regenerar con otro contexto", "Historial"]) await ficha.getByRole("button", { name: accion, exact: true }).waitFor();   // las mismas acciones que en el banco   // la X roja de cerrar, en la esquina de todos los diálogos
  await ficha.getByText("hay una versión más nueva (2)").waitFor();
  if (await ficha.getByText("EDITADO").count()) throw new Error("la ficha debe mostrar la versión fijada (1), no la nueva");
  await page.keyboard.press("Escape");
  paso("[HU-27-5] pulsar un ítem abre la ficha de la versión fijada en la evaluación y avisa si hay una más nueva");

  await enEvaluacion().filter({ hasText: `4b fuera ${sufijo}` }).getByRole("button", { name: "Quitar" }).click();
  await esperar(async () => (await enEvaluacion().count()) === 2);
  await page.getByText("20 min").waitFor();
  paso("[HU-11] quitar un ítem lo saca de la evaluación y actualiza los minutos recomendados");
  // El ítem agregado se ve más oscuro en el banco y su «−» lo quita de la evaluación (el ítem sigue en el banco)
  await banco().filter({ hasText: `4b fuera ${sufijo}` }).getByRole("button", { name: "Agregar" }).click();
  await esperar(async () => (await enEvaluacion().count()) === 3);
  // «en rango» se editó antes: su versión vigente no es la agregada, así que solo los otros dos se ven oscuros
  if ((await page.locator(".fila-item.agregada").count()) !== 2) throw new Error("los ítems agregados deben verse más oscuros en el banco");
  await banco().filter({ hasText: `4b fuera ${sufijo}` }).getByRole("button", { name: "Quitar de la evaluación" }).click();
  await esperar(async () => (await enEvaluacion().count()) === 2);
  await banco().filter({ hasText: `4b fuera ${sufijo}` }).getByRole("button", { name: "Agregar" }).waitFor();
  paso("[HU-11] el ítem agregado se ve más oscuro en el banco y el «−» de su fila lo quita de la evaluación"); 

  // ---------- Entrega 4c ----------
  const evaluacion = async (id) => llamar("GET", `${BUILDER}/evaluations/${id}`);
  const pestana = (nombre) => page.getByRole("tab", { name: nombre });
  const nombrePublica = `Pública E2E ${sufijo}`;

  // Paso 3: resumen, requisitos y aviso de duración
  await botonExacto("Siguiente: publicación →").click();
  await page.getByText("✓ Tiene al menos un ítem").waitFor();
  await page.getByText("✓ Todos los ítems están activos y disponibles").waitFor();
  const resumenProg = page.locator(".skill-resumen", { hasText: "PROG" });
  await resumenProg.waitFor();
  const nivelesProg = await resumenProg.locator(".nivel-celda.activa").allInnerTexts();
  if (nivelesProg.join("") !== "3456") throw new Error(`los niveles de PROG en el resumen son ${nivelesProg.join(",")}`);
  if ((await page.locator(".graficos .torta-anillo").count()) !== 2 || (await page.locator(".graficos .linea-niveles .linea-punto").count()) !== 7) throw new Error("el resumen debe tener dos tortas y un gráfico de líneas con los 7 niveles");
  if (await page.locator(".skills-sin-items").count()) throw new Error("todas las skills tienen ítems: no debe haber bloque «sin ítems»");
  await page.getByRole("button", { name: "Cambiar la duración" }).click();   // la duración se cambia desde el resumen
  await page.getByLabel("Duración total (min)").fill("5");
  await page.getByText("La duración es menor que la suma de los ítems").waitFor();
  await page.getByRole("dialog", { name: "Duración total" }).getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("dialog", { name: "Duración total" }).waitFor({ state: "detached" });
  await page.getByText("5", { exact: true }).first().waitFor();
  paso("[HU-11-4] el paso 3 resume skills con sus niveles y avisa (sin bloquear) si la duración baja de la suma de los ítems");

  // Guardar como plantilla pública: los ítems ya son públicos, no hace falta confirmar nada
  await botonExacto("Guardar como plantilla…").click();
  const dlgPlantilla = page.getByRole("dialog", { name: "Guardar como plantilla" });
  await dlgPlantilla.getByLabel("Nombre").fill(nombrePublica);
  await dlgPlantilla.getByLabel(/Pública/).check();
  if (await dlgPlantilla.getByText("Se harán públicos").count()) throw new Error("con ítems ya públicos no se debe pedir confirmación");
  await dlgPlantilla.getByRole("button", { name: "Guardar plantilla" }).click();
  await page.getByText(`Plantilla «${nombrePublica}» guardada (pública).`).waitFor();
  paso("[HU-12-2] guardar como plantilla pública, con ítems ya públicos, no pide confirmación");

  // Publicar: queda publicada, con la duración fijada, y ya no se edita
  await botonExacto("Publicar").click();
  await page.getByText("Esta evaluación ya no se puede modificar").waitFor();
  const publicada = await evaluacion(evPaso2.id);
  if (publicada.status !== "published" || publicada.duration_minutes !== 5 || publicada.share_token !== null) throw new Error("estado inesperado: " + JSON.stringify(publicada).slice(0, 200));
  if (await page.getByRole("button", { name: "Publicar", exact: true }).count()) throw new Error("una publicada no se vuelve a publicar");
  paso("[HU-12] publicar deja la evaluación publicada (con la duración fijada) en solo lectura, con su recuadro de Ejecuciones");

  // Publicadas: «Ver» abre la versión de solo lectura, con la rúbrica de cada ítem, y se puede duplicar
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await botonExacto("Publicadas").click();
  await page.locator("li.fila-evaluacion", { hasText: `Paso 2 E2E ${sufijo}` }).getByRole("button", { name: "Ver" }).click();
  await page.getByText("Esta evaluación ya no se puede modificar").waitFor();
  await page.locator(".fila-item").first().click();
  await page.getByRole("dialog", { name: "Ficha del ítem" }).waitFor();
  await page.keyboard.press("Escape");
  await botonExacto("Duplicar").click();
  await esperar(async () => (await page.getByLabel("Nombre de la evaluación").inputValue()) === `Paso 2 E2E ${sufijo} (copia)`);
  paso("[HU-12-3] una publicada se ve en solo lectura y se duplica en un borrador nuevo para cambiarla");

  // Guardar como plantilla pública con un ítem propio privado: pide confirmar hacerlo público
  const itemPrivado = await publicar(`4c privado ${sufijo}`, prog.id, 3, false);
  const evPrivada = await llamar("POST", `${BUILDER}/evaluations`, { name: `Con ítem privado ${sufijo}`, skills: [{ skill_id: prog.id, min_level: 1, max_level: 7 }] });
  await llamar("PUT", `${BUILDER}/evaluations/${evPrivada.id}`, { item_version_ids: [itemPrivado.version] });
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await page.locator("li.fila-evaluacion", { hasText: `Con ítem privado ${sufijo}` }).getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Publicación/ }).click();
  await botonExacto("Guardar como plantilla…").click();
  const dlg2 = page.getByRole("dialog", { name: "Guardar como plantilla" });
  await dlg2.getByLabel(/Pública/).check();
  await dlg2.getByText("Se harán públicos").waitFor();
  const guardarPlantilla = dlg2.getByRole("button", { name: "Guardar plantilla" });
  if (!(await guardarPlantilla.isDisabled())) throw new Error("sin confirmar no se puede guardar una plantilla pública con ítems privados");
  await dlg2.getByLabel("Entiendo y quiero hacerlos públicos").check();
  await guardarPlantilla.click();
  await page.getByText(/guardada \(pública\)/).waitFor();
  if (!(await llamar("GET", `${CONTENT}/items/${itemPrivado.id}`)).available_to_experts) throw new Error("el ítem debía quedar público");
  paso("[HU-12-2] una plantilla pública con ítems propios privados pide confirmar y, al aceptar, los hace públicos");

  // Pestaña Plantillas: usar, editar visibilidad, y «no disponible» al desactivar un ítem
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await pestana("Plantillas").click();
  const filaPublica = page.locator("table.tabla-eval tbody tr", { hasText: nombrePublica });
  await filaPublica.getByText("disponible", { exact: true }).waitFor();
  await filaPublica.getByRole("button", { name: "Usar" }).click();
  await esperar(async () => (await page.getByLabel("Nombre de la evaluación").inputValue()) === nombrePublica);
  paso("[HU-12] «Usar» una plantilla crea un borrador y lo abre");
  await page.getByRole("button", { name: "← Mis evaluaciones" }).click();
  await pestana("Plantillas").click();
  await filaPublica.getByRole("button", { name: "Editar" }).click();
  const dlgEditar = page.getByRole("dialog", { name: "Editar plantilla" });
  await dlgEditar.getByLabel(/Privada/).check();
  await dlgEditar.getByRole("button", { name: "Guardar cambios" }).click();
  await filaPublica.getByText("privada", { exact: true }).waitFor();
  await filaPublica.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog", { name: "Editar plantilla" }).getByLabel(/Pública/).check();
  await page.getByRole("dialog", { name: "Editar plantilla" }).getByRole("button", { name: "Guardar cambios" }).click();
  await filaPublica.getByText("pública", { exact: true }).waitFor();
  paso("[HU-12-2] una plantilla propia cambia de visibilidad desde la pestaña Plantillas");

  // Aviso al desactivar un ítem usado en una evaluación publicada y en una plantilla pública
  await page.getByRole("button", { name: "Banco de ítems" }).click();
  await page.locator("section.lista .fila-item", { hasText: `4b skill nueva ${sufijo}` }).first().click();
  let mensaje = "";
  await botonExacto("Desactivar ítem").click();
  mensaje = await confirmar(page, false);
  if (!/1 evaluación publicada/.test(mensaje) || !/plantilla pública/.test(mensaje)) throw new Error("el aviso debe decir dónde se usa el ítem: " + mensaje);
  if ((await llamar("GET", `${CONTENT}/items/${itemNuevo.id}`)).status !== "active") throw new Error("cancelar no debe desactivar el ítem");
  await botonExacto("Desactivar ítem").click();
  await confirmar(page);
  await esperar(async () => (await llamar("GET", `${CONTENT}/items/${itemNuevo.id}`)).status === "inactive");
  paso("[HU-09] desactivar un ítem usado avisa en cuántas evaluaciones publicadas y plantillas públicas está; cancelar no lo desactiva");
  await page.getByRole("button", { name: "Constructor" }).click();
  await pestana("Plantillas").click();
  await filaPublica.getByText("no disponible").waitFor();
  await filaPublica.getByText("inactivo").waitFor();
  if (!(await filaPublica.getByRole("button", { name: "Usar" }).isDisabled())) throw new Error("una plantilla no disponible no se puede usar");
  await llamar("PATCH", `${CONTENT}/items/${itemNuevo.id}/status`, { status: "active" });
  await pestana("Mis roles").click();   // cambiar de pestaña recarga la lista de plantillas
  await pestana("Plantillas").click();
  await filaPublica.getByText("disponible", { exact: true }).waitFor();
  paso("[HU-12] la plantilla pública queda «no disponible» (con el motivo) mientras un ítem esté inactivo y vuelve al reactivarlo");

  // Plantilla: borrar
  const filaPrivada = page.locator("table.tabla-eval tbody tr", { hasText: `Con ítem privado ${sufijo}` });
  await filaPrivada.waitFor();
  await filaPrivada.getByRole("button", { name: "Borrar" }).click();
  await confirmar(page);
  await esperar(async () => (await filaPrivada.count()) === 0);
  paso("[HU-12] una plantilla propia se borra");

  // Mis roles
  await pestana("Mis roles").click();
  await botonExacto("+ Nuevo rol").click();
  await page.getByLabel("Nombre").fill(`Rol E2E 4c ${sufijo}`);
  await botonExacto("Añadir una skill").click();
  await page.getByLabel("Buscar skill").fill("PROG");
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: /^PROG$/ }) }).first().click();
  await botonExacto("Guardar rol").click();
  const filaRol = page.locator(".fila-banco", { hasText: `Rol E2E 4c ${sufijo}` });
  await filaRol.getByText("1 skills").waitFor();
  await filaRol.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nombre").fill(`Rol E2E 4c ${sufijo} editado`);
  await botonExacto("Guardar rol").click();
  const filaEditada = page.locator(".fila-banco", { hasText: `Rol E2E 4c ${sufijo} editado` });
  await filaEditada.waitFor();
  await filaEditada.getByRole("button", { name: "Borrar" }).click();
  await confirmar(page);
  await esperar(async () => (await filaEditada.count()) === 0);
  paso("[HU-38] la pestaña Mis roles crea, edita y borra roles propios (solo skills, sin niveles)");

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
