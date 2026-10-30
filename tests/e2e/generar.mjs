// Prueba E2E del Portal Docente: genera, revisa (edita, descarta, regenera), publica y ve el ítem en el banco.
// Uso: node generar.mjs <url-del-portal> <archivo-de-sesiones.json>
import { readFileSync } from "node:fs";
import { chromium } from "/mnt/c/Users/isaia/Repositorios/Tesis/poc/tests/e2e/node_modules/playwright/index.mjs";

/** Abre el menú "+ Añadir skill…", busca la skill por su código y la elige. */
async function abrirSkill(page, codigo) {
  await page.getByRole("button", { name: "+ Añadir skill…" }).click();
  await page.getByLabel("Buscar skill").fill(codigo);
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: new RegExp(`^${codigo}$`) }) }).first().click();
}

const [portal, archivoSesiones] = process.argv.slice(2);
const sesion = JSON.parse(readFileSync(archivoSesiones, "utf-8")).generar;
const pasos = [];
const paso = (nombre) => { pasos.push(nombre); console.log("✓", nombre); };
const esperar = async (cond, ms = 15000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 200)); } };

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript((s) => { localStorage.setItem("sprint1_token_docente", s.access); localStorage.setItem("sprint1_refresh_docente", s.refresh); }, sesion);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
// El 400 de la publicación inválida es provocado a propósito por la prueba.
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("status of 400")) errores.push(m.text()); });

try {
  await page.goto(`${portal}/docente/`);
  await page.getByText("Qué evaluar").waitFor(); paso("el portal abre con sesión y muestra el paso 1");

  // Partir de un rol SFIA precarga un recuadro por cada skill del perfil (se quitan para seguir con una sola skill)
  await page.locator("select", { hasText: "Rol personalizado" }).selectOption({ index: 1 });
  await esperar(async () => (await page.locator(".recuadro").count()) >= 1);
  paso("[HU-02 c2, HU-06 c1] elegir un rol SFIA precarga un recuadro por cada skill del perfil");
  while (await page.getByRole("button", { name: "Quitar" }).count()) await page.getByRole("button", { name: "Quitar" }).first().click();

  // Paso 1: una skill con 2 alternativas (por defecto) + 1 system design
  // Abrir una categoría del menú no cambia el ancho de ninguna categoría
  await page.getByRole("button", { name: "+ Añadir skill…" }).click();
  const anchos = () => page.locator("section.categoria").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  const anchosCerrados = await anchos();
  for (const cab of await page.locator("button.categoria-cabecera").all()) await cab.click();
  const anchosAbiertos = await anchos();
  if (JSON.stringify(anchosCerrados) !== JSON.stringify(anchosAbiertos)) throw new Error(`los anchos cambiaron: ${anchosCerrados} → ${anchosAbiertos}`);
  paso("[estilo] abrir las categorías del menú no cambia su ancho");
  await page.keyboard.press("Escape");
  await abrirSkill(page, "PROG");
  await page.getByText(/Tipos de ejercicio: cantidad y tiempo/).waitFor(); paso("[HU-06 c1] + Añadir skill crea un recuadro");
  // Los niveles fuera del rango de la skill no se pueden elegir
  await esperar(async () => (await page.locator(".campo-nivel button.nivel-celda:disabled").count()) > 0 || (await page.locator(".campo-nivel button.nivel-celda").count()) === 7);
  const habilitadas = await page.locator(".campo-nivel button.nivel-celda:not(:disabled)").count();
  const total = await page.locator(".campo-nivel button.nivel-celda").count();
  if (total !== 7 || habilitadas < 1) throw new Error("el selector de nivel no tiene 7 celdas");
  const rango = await page.locator(".campo-nivel .suave").first().innerText();
  const m = rango.match(/niveles (\d) a (\d)/); if (!m) throw new Error("no se informa el rango de la skill");
  if (habilitadas !== Number(m[2]) - Number(m[1]) + 1) throw new Error(`habilitadas ${habilitadas} ≠ rango ${m[1]}-${m[2]}`);
  paso("[nivel] solo se pueden elegir los niveles en que la skill está definida");
  const altoAntes = (await page.locator("fieldset").first().boundingBox()).height;
  await page.getByLabel("System design", { exact: true }).check();
  await page.getByLabel("Minutos System design").waitFor();
  const altoDespues = (await page.locator("fieldset").first().boundingBox()).height;
  if (Math.abs(altoAntes - altoDespues) > 0.5) throw new Error(`la altura cambió al marcar un tipo: ${altoAntes} → ${altoDespues}`);
  paso("[estilo] marcar un tipo de ítem no cambia la altura del recuadro");
  await page.getByLabel("Minutos System design").fill("45");  // cada tipo tiene su propio tiempo por ítem
  await page.getByLabel(/Contexto de esta skill/).fill("Fintech chilena");  // el contexto es por skill, en el paso 1
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 2: contexto y resumen
  await page.getByText("2. Resumen").waitFor();
  await page.getByText(/contexto: Fintech chilena/).waitFor(); paso("[contexto] el resumen muestra el contexto de la skill y ya no pide uno general");
  await page.getByText(/2× Alternativa única \(2 min c\/u\), 1× System design \(45 min c\/u\)/).waitFor(); paso("[HU-06 c2] el resumen lista los tipos, cantidades y minutos por ítem");
  await page.getByRole("button", { name: "Generar", exact: true }).click();

  // Paso 3: revisión
  await page.getByText("Revisa los borradores").waitFor({ timeout: 30000 });
  const tarjetas = page.locator("article.borrador");
  await esperar(async () => (await tarjetas.count()) === 3); paso("[HU-04, HU-27 c1] la IA devolvió 3 borradores para revisar");
  await page.getByRole("button", { name: "Publicar 3 preguntas" }).waitFor();

  // Editar el primero
  await tarjetas.nth(0).getByRole("button", { name: "Editar" }).click();
  await tarjetas.nth(0).getByLabel("Enunciado").fill("Enunciado corregido E2E");
  await tarjetas.nth(0).getByRole("button", { name: "Cerrar edición" }).click();
  await tarjetas.nth(0).getByText("Enunciado corregido E2E").waitFor(); paso("[HU-28 c1] editar cambia el borrador en pantalla");

  // El tiempo es por ítem: se cambia en el primer borrador
  await tarjetas.nth(0).getByLabel("Tiempo estimado").fill("7"); paso("[HU-28 c1] el tiempo estimado se edita por borrador");

  // Descartar el segundo
  await tarjetas.nth(1).getByRole("button", { name: "Descartar" }).click();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).waitFor(); paso("[HU-30 c1, c3] descartar baja el contador a 2");
  await tarjetas.nth(1).getByRole("button", { name: "Restaurar" }).click();
  await page.getByRole("button", { name: "Publicar 3 preguntas" }).waitFor(); paso("[HU-30 c2] restaurar lo devuelve a 3");
  await tarjetas.nth(1).getByRole("button", { name: "Descartar" }).click();

  // Regenerar el tercero con feedback (la IA simulada devuelve otro ítem de ejemplo)
  await tarjetas.nth(2).getByRole("button", { name: "Regenerar", exact: true }).click();
  await tarjetas.nth(2).getByLabel(/Comentario para la IA/).fill("Más difícil");
  await tarjetas.nth(2).getByRole("button", { name: "Regenerar este borrador" }).click();
  await esperar(async () => !(await tarjetas.nth(2).getByLabel(/Comentario para la IA/).count())); paso("[HU-29 c1, c3] regenerar con feedback reemplaza el borrador");

  // Una edición inválida se rechaza al publicar (pesos de la rúbrica) y no guarda nada
  await tarjetas.nth(2).getByRole("button", { name: "Editar" }).click();
  await tarjetas.nth(2).locator(".criterio input[type=number]").first().fill("10");
  await tarjetas.nth(2).getByText("deben sumar 100").waitFor();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).click();
  await page.locator("footer.publicar .error").waitFor(); paso("[HU-28 c3, HU-31 c4] una rúbrica que no suma 100 se rechaza al publicar");
  await tarjetas.nth(2).locator(".criterio input[type=number]").first().fill("60");

  // Publicar, disponible para expertos
  await page.getByLabel(/a disposición de expertos/).check();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).click();
  await page.getByText("Se publicaron 2 pregunta(s)").waitFor(); paso("[HU-31 c1, c3] publicar guarda 2 preguntas y bloquea la pantalla");
  await page.getByRole("button", { name: "Generar más preguntas" }).waitFor();

  // Banco: el ítem editado, con alternativas en letras y disponible para expertos
  await page.getByRole("button", { name: "Banco de ítems" }).click();
  await page.locator("button.fila", { hasText: "Enunciado corregido E2E" }).first().click();
  await page.locator("ol.alternativas").waitFor();
  const estilo = await page.locator("ol.alternativas").evaluate((e) => getComputedStyle(e).listStyleType);
  if (estilo !== "upper-alpha") throw new Error(`las alternativas usan "${estilo}"`);
  paso("[HU-08] las alternativas se enumeran con letras (A, B, C)");
  await page.getByText(/disponible para expertos/).first().waitFor(); paso("[HU-31 c2] el detalle indica 'disponible para expertos'");
  await page.locator("section.lista button.fila .etiqueta", { hasText: /^(público|privado)$/ }).first().waitFor();
  if (await page.locator("section.lista, section.panel").getByText("Sin puntuar", { exact: true }).count() !== 0) throw new Error("no debe aparecer la etiqueta 'Sin puntuar'");
  // (la base puede tener otros ítems ya puntuados; se revisan los PROG recién publicados, que no tienen puntuación)
  if (await page.locator("section.lista button.fila", { hasText: "PROG" }).locator(".etiqueta.puntuado").count() !== 0) throw new Error("un ítem sin puntuar no debe mostrar estrella");
  paso("[banco] cada ítem dice público o privado y los ítems sin puntuar no muestran etiqueta de puntaje");
  // Filtros del banco: la skill se elige con el mismo menú de "Añadir skill" y hay filtro por nivel
  const totalItems = async () => Number((await page.locator("section.lista > p.suave").first().innerText()).match(/(\d+) ítem/)[1]);
  await page.locator(".filtros .campo-filtro button").click();
  await page.getByLabel("Buscar skill").fill("PROG");
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: /^PROG$/ }) }).first().click();
  await esperar(async () => (await totalItems()) >= 1);
  await page.getByLabel("Nivel de responsabilidad").selectOption("7");
  await esperar(async () => (await totalItems()) === 0);
  await page.getByLabel("Nivel de responsabilidad").selectOption("3");
  await esperar(async () => (await totalItems()) >= 1);
  await page.locator(".filtros .campo-filtro button").click();
  await page.getByRole("button", { name: "Todas las skills" }).click();
  paso("[HU-07] el filtro de skill usa el menú con buscador y hay filtro por nivel de responsabilidad");
  await page.getByText(/· 7 min ·/).first().waitFor();
  await page.locator("button.fila", { hasText: "45 min" }).first().waitFor(); paso("[HU-06 c2, HU-28 c1] cada ítem se guardó con su propio tiempo (7 y 45 min)");

  // El catálogo es un enlace al sitio de SFIA
  const href = await page.getByRole("link", { name: /Catálogo SFIA/ }).getAttribute("href");
  if (href !== "https://sfia-online.org/en/sfia-9") throw new Error(`enlace inesperado: ${href}`);
  paso("[HU-02 c1] el catálogo SFIA es un enlace a sfia-online.org");

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
