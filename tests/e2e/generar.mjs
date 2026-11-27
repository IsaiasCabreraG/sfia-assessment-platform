// Prueba E2E del Portal Docente: genera, revisa (edita, descarta, regenera), publica y ve el ítem en el banco.
// Uso: node generar.mjs <url-del-portal> <archivo-de-sesiones.json>
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

/** Abre el menú «Añadir una skill», busca la skill por su código y la elige. */
async function abrirSkill(page, codigo) {
  await page.getByRole("button", { name: "Añadir una skill" }).click();
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
await ctx.addInitScript((s) => { localStorage.setItem("sfia_token_docente", s.access); localStorage.setItem("sfia_refresh_docente", s.refresh); }, sesion);
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
// El 400 de la publicación inválida es provocado a propósito por la prueba.
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("status of 400")) errores.push(m.text()); });

try {
  await page.goto(`${portal}/docente/`);
  await page.getByText("Qué evaluar").waitFor(); paso("el portal abre con sesión y muestra el paso 1");

  // Añadir skills desde un rol: 21 familias → roles → skills core y related, sin ninguna marcada de antemano
  await page.getByRole("button", { name: "Añadir desde un rol", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Añadir skills de un rol" });
  await dialogo.locator("button.categoria-cabecera").first().waitFor(); // las familias cargan después de abrir el diálogo
  if ((await dialogo.locator("button.categoria-cabecera").count()) !== 21) throw new Error(`se esperaban 21 familias y hay ${await dialogo.locator("button.categoria-cabecera").count()}`);
  await dialogo.locator("button.categoria-cabecera").nth(2).click(); await dialogo.locator("button.categoria-cabecera").nth(5).click();
  await dialogo.getByLabel("Buscar rol").fill("Accessibility practitioners");
  await dialogo.locator("button.rol-opcion", { hasText: "Accessibility practitioners" }).click();
  await dialogo.getByRole("heading", { name: /^Skills core/ }).waitFor();
  await dialogo.getByRole("heading", { name: /^Skills related/ }).waitFor();
  if ((await dialogo.locator(".skill-tarjeta[aria-checked=true]").count()) !== 0) throw new Error("ninguna skill debe venir elegida");
  const botonAgregar = dialogo.getByRole("button", { name: /^Añadir/ });
  if ((await dialogo.locator(".modal-pie").getByRole("button", { name: /^Añadir/ }).count()) !== 1) throw new Error("los botones de acción deben estar en el pie fijo del diálogo");
  if (!(await botonAgregar.isDisabled())) throw new Error("sin skills marcadas no se puede añadir");
  await dialogo.locator(".rol-grupo").nth(0).locator(".skill-tarjeta").first().click();
  await dialogo.locator(".rol-grupo").nth(1).locator(".skill-tarjeta").first().click();
  await dialogo.getByRole("button", { name: "Añadir 2 skills" }).click();
  await esperar(async () => (await page.locator(".recuadro").count()) === 2);
  paso("[roles] se elige un rol por familia, se ven sus skills core y related sin ninguna marcada y se añaden solo las marcadas");
  // Las skills que ya están en el formulario se ven marcadas, avisan y no se pueden desmarcar; se pueden sumar skills de otro rol
  await page.getByRole("button", { name: "Añadir desde un rol", exact: true }).click();
  await dialogo.getByLabel("Buscar rol").fill("Accessibility practitioners");
  await dialogo.locator("button.rol-opcion", { hasText: "Accessibility practitioners" }).click();
  await dialogo.getByRole("heading", { name: /^Skills core/ }).waitFor();
  if ((await dialogo.locator(".skill-tarjeta[aria-checked=true][disabled]").count()) !== 2) throw new Error("las 2 skills ya añadidas deben verse elegidas y bloqueadas");
  if ((await dialogo.getByText("ya está en el formulario").count()) !== 2) throw new Error("falta el aviso de las skills ya añadidas");
  await dialogo.getByRole("button", { name: "← Roles" }).click();
  await dialogo.getByLabel("Buscar rol").fill("Agile change agents");
  await dialogo.locator("button.rol-opcion", { hasText: "Agile change agents" }).click();
  await dialogo.locator(".skill-tarjeta:not([disabled])").first().click();
  await dialogo.getByRole("button", { name: "Añadir 1 skill" }).click();
  await esperar(async () => (await page.locator(".recuadro").count()) === 3);
  paso("[roles] las skills ya añadidas avisan y no se desmarcan; se puede sumar un segundo rol sin perder lo anterior");
  while (await page.getByRole("button", { name: "Quitar" }).count()) await page.getByRole("button", { name: "Quitar" }).first().click();

  // Paso 1: una skill con 2 alternativas (por defecto) + 1 system design
  // Abrir una categoría del menú no cambia el ancho de ninguna categoría
  await page.getByRole("button", { name: "Añadir una skill" }).click();
  const anchos = () => page.locator("section.categoria").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  const anchosCerrados = await anchos();
  for (const cab of await page.locator("button.categoria-cabecera").all()) await cab.click();
  const anchosAbiertos = await anchos();
  if (JSON.stringify(anchosCerrados) !== JSON.stringify(anchosAbiertos)) throw new Error(`los anchos cambiaron: ${anchosCerrados} → ${anchosAbiertos}`);
  paso("[estilo] abrir las categorías del menú no cambia su ancho");
  await page.keyboard.press("Escape");
  await abrirSkill(page, "PROG");
  await page.getByText("Tipos de ítem", { exact: true }).waitFor(); paso("[HU-06 c1] «Añadir una skill» crea un recuadro");
  if ((await page.locator(".fila-tipo input[type=checkbox]:checked").count()) !== 0) throw new Error("por defecto no debe haber ningún tipo de ítem marcado");
  await page.getByLabel("Alternativa única", { exact: true }).check();
  paso("[paso 1] por defecto no hay ningún tipo de ítem marcado");
  // El paso ocupa al menos el 70 % del ancho, la skill y su nivel van en la misma fila y los tipos se leen con letra más grande
  const anchoPaso = (await page.locator("section.pagina").boundingBox()).width, anchoMain = (await page.locator("main").boundingBox()).width;
  if (anchoPaso / anchoMain < 0.7) throw new Error(`el paso ocupa solo ${Math.round((anchoPaso / anchoMain) * 100)} % del ancho`);
  const [ySkill, yNivel] = await Promise.all([0, 1].map(async (i) => (await page.locator(".fila-skill-nivel > .campo-nivel").nth(i).boundingBox()).y));
  if (Math.abs(ySkill - yNivel) > 5) throw new Error("la skill y el nivel de responsabilidad no están en la misma fila");
  const letraTipo = await page.locator(".fila-tipo").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  if (letraTipo < 16) throw new Error(`la letra de los tipos es pequeña (${letraTipo}px)`);
  await page.getByText("Tiempo (min)", { exact: true }).waitFor();
  paso("[paso 1] ocupa ≥70 % del ancho, skill y nivel en la misma fila, tipos con letra mayor y columna 'Tiempo (min)'");
  // HU-06-2: la ayuda aparece al pasar el cursor; un solo tooltip por columna (Cantidad y Min c/u) y uno por tipo, con su icono
  if ((await page.locator(".recuadro .cab .ayuda").count()) !== 2) throw new Error("debe haber un tooltip por columna (Cantidad y Min c/u)");
  if ((await page.locator(".recuadro .fila-tipo .ayuda").count()) !== 6) throw new Error("debe haber un tooltip por tipo de ejercicio");
  if ((await page.locator(".recuadro .fila-tipo .icono-tipo").count()) !== 6) throw new Error("cada tipo de ejercicio debe mostrar su icono");
  const titulo = page.locator(".recuadro .cab .ayuda").first();
  await titulo.hover();
  const contenido = await titulo.evaluate((e) => getComputedStyle(e, "::after").content);
  if (!contenido.includes("Cuántos ítems")) throw new Error(`el tooltip de Cantidad no se muestra: ${contenido}`);
  paso("[HU-06-2] 'Cantidad' y 'Min c/u' tienen un solo tooltip al pasar el cursor, y cada tipo tiene su icono y el suyo");
  // Los niveles fuera del rango de la skill no se pueden elegir
  await esperar(async () => (await page.locator(".campo-nivel button.nivel-celda:disabled").count()) > 0 || (await page.locator(".campo-nivel button.nivel-celda").count()) === 7);
  const habilitadas = await page.locator(".campo-nivel button.nivel-celda:not(:disabled)").count();
  const total = await page.locator(".campo-nivel button.nivel-celda").count();
  if (total !== 7 || habilitadas < 1) throw new Error("el selector de nivel no tiene 7 celdas");
  if (await page.locator(".campo-nivel .suave").first().innerText().then((x) => /definida en los niveles/.test(x))) throw new Error("no debe repetirse el rango de la skill en texto");
  if ((await page.locator(".campo-nivel button.nivel-celda.elegida").count()) !== 1) throw new Error("debe verse con claridad el nivel elegido");
  paso("[nivel] solo se pueden elegir los niveles en que la skill está definida, se ve cuál está elegido y no se repite el rango en texto");
  const altoAntes = (await page.locator("fieldset").first().boundingBox()).height;
  await page.getByLabel("System design", { exact: true }).check();
  await page.getByLabel("Minutos System design").waitFor();
  if ((await page.locator(".recuadro .cab .ayuda").count()) !== 2) throw new Error("al marcar más tipos se repitieron los títulos de columna");
  const altoDespues = (await page.locator("fieldset").first().boundingBox()).height;
  if (Math.abs(altoAntes - altoDespues) > 0.5) throw new Error(`la altura cambió al marcar un tipo: ${altoAntes} → ${altoDespues}`);
  paso("[estilo] marcar un tipo de ítem no cambia la altura del recuadro");
  await page.getByLabel("Minutos System design").fill("45");  // cada tipo tiene su propio tiempo por ítem
  await page.getByLabel(/Contexto para la skill/).fill("Fintech chilena");  // el contexto es por skill, en el paso 1
  // Sin ningún tipo marcado, «Siguiente» no se puede pulsar y la pantalla explica por qué
  await page.getByLabel("Alternativa única", { exact: true }).uncheck();
  await page.getByLabel("System design", { exact: true }).uncheck();
  if (!(await page.getByRole("button", { name: "Siguiente" }).isDisabled())) throw new Error("«Siguiente» debe estar desactivado sin tipos");
  const motivoSinTipos = await page.locator(".barra-flotante .error").innerText();
  if (!/Hay una skill sin tipo de ítem/.test(motivoSinTipos)) throw new Error(`motivo: ${motivoSinTipos}`);
  await page.getByText("Marca al menos un tipo de ítem.", { exact: true }).waitFor();
  // el aviso va al mismo nivel que «Cantidad» y «Tiempo» y no empuja nada hacia abajo
  const [yAviso, yCantidad] = await Promise.all([page.locator(".aviso-tipos"), page.locator(".recuadro .cab").first()].map(async (l) => (await l.boundingBox()).y));
  if (Math.abs(yAviso - yCantidad) > 5) throw new Error("el aviso de «sin tipos» no está al nivel de Cantidad y Tiempo");
  // Minimizada, la skill sin tipos lo dice en rojo; junto a «Siguiente» el mensaje es genérico y no lo repite
  await page.getByRole("button", { name: "Minimizar todo" }).click();
  await page.locator(".recuadro-cabecera .error", { hasText: "Sin tipo de ítem seleccionado" }).waitFor();
  if (/Sin tipo de ítem seleccionado/.test(await page.locator(".barra-flotante .error").innerText())) throw new Error("el mensaje de «Siguiente» no debe repetir el de la skill");
  await page.getByRole("button", { name: "Expandir todo" }).click();
  paso("[paso 1] sin ningún tipo marcado, «Siguiente» queda desactivado con un mensaje genérico y la skill minimizada lo dice en rojo");
  await page.getByLabel("Alternativa única", { exact: true }).check();
  await page.getByLabel("System design", { exact: true }).check();
  await page.getByLabel("Cantidad Alternativa única").fill("2");
  await page.getByLabel("Minutos System design").fill("45");
  // Los tiempos se cambian con «−» y «+» (también se escriben), sin las flechitas del navegador
  const contadorMin = page.locator(".contador", { has: page.getByLabel("Minutos System design") });
  await contadorMin.getByRole("button", { name: "Más" }).click();
  if ((await page.getByLabel("Minutos System design").inputValue()) !== "46") throw new Error("«+» debe sumar un minuto");
  await contadorMin.getByRole("button", { name: "Menos" }).click();
  if ((await page.getByLabel("Minutos System design").inputValue()) !== "45") throw new Error("«−» debe restar un minuto");
  if ((await page.getByLabel("Minutos System design").evaluate((e) => getComputedStyle(e).appearance)) !== "textfield") throw new Error("el campo no debe mostrar las flechitas del navegador");
  const cajaContador = await contadorMin.boundingBox(), cajaMas = await contadorMin.getByRole("button", { name: "Más" }).boundingBox();
  if (Math.abs(cajaContador.x + cajaContador.width - (cajaMas.x + cajaMas.width)) > 1.5) throw new Error("el campo debe terminar donde termina el «+»");
  paso("[paso 1] los tiempos tienen «−» y «+», se pueden escribir, no muestran flechitas y el campo termina en el «+»");
  if (await page.locator(".barra-flotante .error").count()) throw new Error("el motivo debe desaparecer al marcar tipos");

  // Minimizados, los recuadros muestran el icono, la cantidad y los minutos de cada tipo en lugar de su nombre
  await page.getByRole("button", { name: "Minimizar todo" }).click();
  const cabecera = page.locator(".recuadro-cabecera").first();
  if ((await cabecera.locator(".tipo-resumen .icono-tipo").count()) !== 2) throw new Error("el recuadro minimizado debe mostrar un icono por tipo pedido");
  const textoCabecera = await cabecera.innerText();
  if (!/2×/.test(textoCabecera) || !/45 min/.test(textoCabecera) || /Alternativa única|System design/.test(textoCabecera)) throw new Error(`resumen minimizado: ${textoCabecera}`);
  paso("[paso 1] un recuadro minimizado muestra el icono, la cantidad y los minutos de cada tipo");
  await page.getByRole("button", { name: "Expandir todo" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 2: contexto y resumen
  await page.getByText("2. Resumen").waitFor();
  await page.getByText(/contexto: Fintech chilena/).waitFor(); paso("[contexto] el resumen muestra el contexto de la skill y ya no pide uno general");
  await page.locator(".resumen-item", { hasText: "2×" }).filter({ hasText: "45 min" }).waitFor(); paso("[HU-06 c2] el resumen lista los tipos, cantidades y minutos por ítem");
  await page.getByRole("button", { name: "Generar", exact: true }).click();

  // Paso 3: revisión (la lista de borradores a la izquierda y el elegido, completo, a la derecha)
  await page.getByText("Revisa los borradores").waitFor({ timeout: 30000 });
  const filas = page.locator("button.borrador-fila");
  const panel = page.locator(".panel-borrador");
  await esperar(async () => (await filas.count()) === 3); paso("[HU-04, HU-27 c1] la IA devolvió 3 borradores para revisar");
  await page.getByRole("button", { name: "Publicar 3 preguntas" }).waitFor();

  // HU-27-3: indicador fijo con el número del borrador y el total
  await panel.getByText("Borrador 1 de 3").waitFor();
  await filas.nth(2).click();
  await panel.getByText("Borrador 3 de 3").waitFor();
  const posicion = await panel.locator(".panel-cabecera").evaluate((e) => getComputedStyle(e).position);
  if (posicion !== "sticky") throw new Error(`el indicador no es fijo (${posicion})`);
  paso("[HU-27-3] el indicador 'Borrador N de M' es fijo y cambia al elegir otro borrador");

  // HU-27-6: lo que verá el alumno se distingue de lo que solo ve el docente
  await panel.locator(".vista-alumno").waitFor(); await panel.locator(".vista-docente").waitFor();
  if (await panel.locator(".vista-alumno").getByText("Qué evalúa").count()) throw new Error("el marco del alumno muestra lo del docente");
  paso("[HU-27-6] el borrador separa lo que verá el alumno de lo que solo ve el docente");

  // HU-27-4: la rúbrica del system design (tercer borrador) se ve como matriz, con criterios en filas y niveles en columnas
  const encabezados = await panel.locator("table.rubrica thead th").allInnerTexts();
  if (encabezados.join(",") !== "Criterio (peso),0,1,2,3") throw new Error(`encabezados de la rúbrica: ${encabezados}`);
  if ((await panel.locator("table.rubrica tbody tr").count()) < 4) throw new Error("la matriz no muestra los 4 criterios");
  paso("[HU-27-4] la rúbrica se muestra como matriz (criterios en filas, niveles en columnas)");

  // HU-30-2: volver descarta los borradores generados pero conserva la selección
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await confirmar(page);
  await page.getByText("2. Resumen").waitFor();
  await page.locator(".resumen-item", { hasText: "2×" }).filter({ hasText: "45 min" }).waitFor();
  await page.getByRole("button", { name: "Generar", exact: true }).click();
  await page.getByText("Revisa los borradores").waitFor({ timeout: 30000 });
  await esperar(async () => (await filas.count()) === 3);
  paso("[HU-30-2] volver descarta los borradores y conserva la selección para generar otra tanda");

  // Editar el primero
  await filas.nth(0).click();
  await panel.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Enunciado").fill("Enunciado corregido E2E");
  await panel.getByRole("button", { name: "Cerrar edición" }).click();
  await panel.getByText("Enunciado corregido E2E").waitFor(); paso("[HU-28 c1] editar cambia el borrador en pantalla");

  // El tiempo es por ítem: se cambia en el primer borrador
  await page.getByLabel("Tiempo estimado").fill("7"); paso("[HU-28 c1] el tiempo estimado se edita por borrador");

  // Descartar el segundo, restaurarlo y volver a descartarlo
  await filas.nth(1).click();
  await panel.getByRole("button", { name: "Descartar" }).click();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).waitFor(); paso("[HU-30 c1, c3] descartar baja el contador a 2");
  await panel.getByRole("button", { name: "Restaurar" }).click();
  await page.getByRole("button", { name: "Publicar 3 preguntas" }).waitFor(); paso("[HU-30 c2] restaurar lo devuelve a 3");
  await panel.getByRole("button", { name: "Descartar" }).click();

  // Regenerar el tercero con feedback (la IA simulada devuelve otro ítem de ejemplo)
  await filas.nth(2).click();
  await panel.getByRole("button", { name: "Regenerar", exact: true }).click();
  // el comentario para la IA aparece debajo del borrador y no arriba
  const yBorrador = (await panel.locator(".vista-borrador").boundingBox()).y;
  const yComentario = (await panel.locator(".regenerar-caja").boundingBox()).y;
  if (yComentario <= yBorrador) throw new Error("el comentario para la IA debe salir debajo del borrador");
  await panel.getByLabel(/Comentario para la IA/).fill("Más difícil");
  await panel.getByRole("button", { name: "Regenerar este borrador" }).click();
  await esperar(async () => !(await panel.getByLabel(/Comentario para la IA/).count())); paso("[HU-29 c1, c3] regenerar con feedback reemplaza el borrador y el comentario sale debajo");

  // Una edición inválida se rechaza al publicar (pesos de la rúbrica) y no guarda nada
  await panel.getByRole("button", { name: "Editar", exact: true }).click();
  // Al editar se conserva el orden de la vista: enunciado, lo que ve el alumno, qué evalúa, lo del docente y la rúbrica
  const etiquetas = ["Enunciado", "Escenario", "Requisitos funcionales", "Requisitos no funcionales", "Restricciones", "Qué evalúa", "Respuesta de referencia", "Rúbrica"];
  const textoEditor = await panel.locator(".editor").innerText();
  const posiciones = etiquetas.map((e) => textoEditor.indexOf(e));
  if (posiciones.some((p, i) => p < 0 || (i > 0 && p <= posiciones[i - 1]))) throw new Error(`el editor cambió el orden: ${posiciones}`);
  paso("[HU-27-2] al editar se mantiene el orden de la vista (enunciado, lo del alumno, qué evalúa, lo del docente y la rúbrica)");
  // (los pesos de los criterios fijos están bloqueados: se edita el primer criterio que no es fijo)
  await panel.locator(".criterio input[type=number]:not([disabled])").first().fill("10");
  await panel.getByText("deben sumar 100").waitFor();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).click();
  await page.locator("footer.publicar .error").waitFor(); paso("[HU-28 c3, HU-31 c4] una rúbrica que no suma 100 se rechaza al publicar");
  await panel.locator(".criterio input[type=number]:not([disabled])").first().fill("25");

  // Publicar, disponible para expertos
  await page.getByLabel(/a disposición de expertos/).check();
  await page.getByRole("button", { name: "Publicar 2 preguntas" }).click();
  await page.getByText("Se publicaron 2 pregunta(s)").waitFor(); paso("[HU-31 c1, c3] publicar guarda 2 preguntas y bloquea la pantalla");
  await page.getByRole("button", { name: "Generar más preguntas" }).waitFor();

  // Banco: el ítem editado, con alternativas en letras y disponible para expertos
  await page.getByRole("button", { name: "Banco de ítems" }).click();
  await page.locator("section.lista .fila-item", { hasText: "Enunciado corregido E2E" }).first().click();
  await page.locator("ol.alternativas").waitFor();
  const estilo = await page.locator("ol.alternativas").evaluate((e) => getComputedStyle(e).listStyleType);
  if (estilo !== "upper-alpha") throw new Error(`las alternativas usan "${estilo}"`);
  paso("[HU-08] las alternativas se enumeran con letras (A, B, C)");
  await page.getByText(/Disponible para expertos/).first().waitFor(); paso("[HU-31 c2] el detalle indica 'disponible para expertos'");
  // HU-37: la lista muestra el tipo con un icono y el nivel con color, en lugar de texto
  const primera = page.locator("section.lista .fila-item").first();
  await primera.locator(".icono-tipo [role=img]").waitFor();
  await primera.locator(".nivel-celda.activa").waitFor();
  const tipoIcono = await primera.locator(".icono-tipo [role=img]").getAttribute("title");
  if (!["Alternativa única", "Verdadero o falso", "Pregunta de desarrollo", "Coding challenge", "System design", "Debugging"].includes(tipoIcono)) throw new Error(`título del icono: ${tipoIcono}`);
  paso("[HU-37] cada ítem del banco muestra su tipo con un icono y su nivel con color");
  // Lo público no lleva etiqueta y lo privado dice «Privado»; la versión no se muestra en la lista
  if (await page.locator("section.lista .fila-item", { hasText: "Enunciado corregido E2E" }).first().getByText("Privado", { exact: true }).count()) throw new Error("un ítem disponible para expertos no debe decir Privado");
  if (await page.locator("section.lista .fila-item").first().getByText(/versión/i).count()) throw new Error("la lista no debe mostrar la versión");
  if (await page.locator("section.lista, section.panel").getByText("Sin puntuar", { exact: true }).count() !== 0) throw new Error("no debe aparecer la etiqueta 'Sin puntuar'");
  // (la base puede tener otros ítems ya puntuados; se revisan los PROG recién publicados, que no tienen puntuación)
  if (await page.locator("section.lista .fila-item", { hasText: "PROG" }).locator(".etiqueta.puntuado").count() !== 0) throw new Error("un ítem sin puntuar no debe mostrar estrella");
  paso("[banco] lo privado se marca como «Privado» y los ítems sin puntuar no muestran etiqueta de puntaje");
  // Filtros del banco: varias skills como burbujas (con el mismo menú de «Añadir una skill») y nivel como rango de cuadritos
  const totalItems = async () => Number((await page.locator("section.lista .lista-cabecera > span.suave").first().innerText()).match(/(\d+) ítem/)[1]);
  const sinFiltro = await totalItems();
  await page.locator(".filtros").getByRole("button", { name: "Añadir una skill" }).click();
  await page.getByLabel("Buscar skill").fill("PROG");
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: /^PROG$/ }) }).first().click();
  await page.locator(".filtros .burbuja", { hasText: "PROG" }).waitFor();
  await esperar(async () => (await totalItems()) >= 1 && (await totalItems()) <= sinFiltro);
  const nivelesBanco = page.getByRole("group", { name: "Nivel de responsabilidad" });
  await nivelesBanco.getByRole("button", { name: "Nivel 7", exact: true }).click();
  await esperar(async () => (await totalItems()) === 0);
  await nivelesBanco.getByRole("button", { name: "Nivel 3", exact: true }).click();   // un nivel y luego otro: de 3 a 7
  await esperar(async () => (await totalItems()) >= 1);
  await page.getByRole("button", { name: "Quitar PROG" }).click();
  await esperar(async () => (await totalItems()) >= 1);
  await page.getByLabel("Ordenar por").selectOption("time");
  await esperar(async () => {
    const minutos = (await page.locator("section.lista .fila-item-datos > .suave").allInnerTexts()).map((x) => parseInt(x));
    return minutos.length > 1 && minutos.every((m, i) => i === 0 || minutos[i - 1] <= m);   // de menor a mayor
  });
  if ((await page.locator("section.lista .lista-cabecera .paginacion").count()) !== 1) throw new Error("falta la paginación sobre la lista");
  paso("[HU-07] el banco filtra por varias skills (burbujas), por rango de nivel y se ordena por tiempo");
  await page.locator("section.lista .fila-item", { has: page.locator(".fila-item-datos > .suave", { hasText: /^7 min$/ }) }).first().waitFor();
  await page.locator("section.lista .fila-item", { has: page.locator(".fila-item-datos > .suave", { hasText: /^45 min$/ }) }).first().waitFor(); paso("[HU-06 c2, HU-28 c1] cada ítem se guardó con su propio tiempo (7 y 45 min)");

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
