// Prueba E2E de la sesión con refresh token en el Portal Docente.
// Uso: node sesion.mjs <url-del-portal> <archivo-de-sesiones.json>
import { readFileSync } from "node:fs";
import { chromium } from "/mnt/c/Users/isaia/Repositorios/Tesis/poc/tests/e2e/node_modules/playwright/index.mjs";

/** Abre el menú "+ Añadir skill…", busca la skill por su código y la elige. */
async function abrirSkill(page, codigo) {
  await page.getByRole("button", { name: "+ Añadir skill…" }).click();
  await page.getByLabel("Buscar skill").fill(codigo);
  await page.locator("button.skill-opcion", { has: page.locator(".codigo", { hasText: new RegExp(`^${codigo}$`) }) }).first().click();
}

const [portal, archivo] = process.argv.slice(2);
const sesiones = JSON.parse(readFileSync(archivo, "utf-8"));
const IDENTITY = "http://localhost:9001";
const browser = await chromium.launch();
let hechas = 0;
const ok = (n) => { hechas++; console.log("✓", n); };

/** Abre el portal con una sesión guardada en localStorage y devuelve la página. */
async function abrir(s) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((x) => {
    if (!sessionStorage.getItem("ya")) { // solo la primera carga: las siguientes conservan lo que haga la aplicación
      sessionStorage.setItem("ya", "1");
      localStorage.setItem("sprint1_token_docente", x.access);
      localStorage.setItem("sprint1_refresh_docente", x.refresh);
    }
  }, s);
  const page = await ctx.newPage();
  await page.goto(`${portal}/docente/`);
  return page;
}
const guardado = (page) => page.evaluate(() => ({ a: localStorage.getItem("sprint1_token_docente"), r: localStorage.getItem("sprint1_refresh_docente") }));

/** Deja el access token vencido (la firma ya no coincide): el backend responde 401 en la siguiente llamada. */
const vencerAccess = (page) => page.evaluate(() => {
  const [h, p, f] = localStorage.getItem("sprint1_token_docente").split(".");
  const cuerpo = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  cuerpo.exp = Math.floor(Date.now() / 1000) - 10;
  localStorage.setItem("sprint1_token_docente", [h, btoa(JSON.stringify(cuerpo)).replace(/=+$/, ""), f].join("."));
});

/** Genera un borrador de alternativa única y lo edita, para tener trabajo sin publicar en pantalla. */
async function conBorradorEditado(s, texto) {
  const page = await abrir(s);
  await page.getByText("Qué evaluar").waitFor();
  await abrirSkill(page, "PROG");
  await page.getByLabel("Cantidad Alternativa única").fill("1");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Generar", exact: true }).click();
  await page.getByText("Revisa los borradores").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Enunciado").fill(texto);
  await page.getByRole("button", { name: "Cerrar edición" }).click();
  await page.locator(".panel-borrador").getByText(texto).waitFor();
  return page;
}

try {
  // 1. Access vencido + refresh válido: el portal abre solo y rota los tokens.
  let page = await abrir(sesiones.vencida);
  await page.getByText("Qué evaluar").waitFor();
  let g = await guardado(page);
  if (g.a === sesiones.vencida.access || g.r === sesiones.vencida.refresh) throw new Error("los tokens no se renovaron");
  ok("[HU-01 c3] con el access token vencido y refresh válido, el portal abre sin pedir login y rota los tokens");

  // 2. Access vencido + refresh inválido: vuelve al acceso con Google y limpia los tokens.
  page = await abrir(sesiones.invalida);
  await page.getByRole("button", { name: "Iniciar sesión con Google" }).waitFor();
  g = await guardado(page);
  if (g.a || g.r) throw new Error("quedaron tokens guardados");
  ok("[HU-01 c3] con el refresh inválido, se muestra el acceso con Google y se borran los tokens");

  // 3. Autorizado después de iniciar sesión: la renovación trae el rol nuevo, sin pasar por 'sesión vieja'.
  page = await abrir(sesiones.rol_nuevo);
  await page.getByText("Qué evaluar").waitFor();
  ok("[HU-01 c3] un rol asignado después del login se aplica solo al renovar la sesión");

  // 4. El access vence a mitad del uso: la siguiente acción lo renueva y sigue funcionando.
  page = await abrir(sesiones.a_mitad);
  await page.getByText("Qué evaluar").waitFor();
  const antes = (await guardado(page)).a;
  await page.evaluate(() => {  // simula que pasó la hora: deja un access vencido (firma válida, exp pasado)
    const [h, p, f] = localStorage.getItem("sprint1_token_docente").split(".");
    const cuerpo = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    cuerpo.exp = Math.floor(Date.now() / 1000) - 10;  // la firma ya no coincide: el backend lo rechaza igual con 401
    localStorage.setItem("sprint1_token_docente", [h, btoa(JSON.stringify(cuerpo)).replace(/=+$/, ""), f].join("."));
  });
  await page.getByRole("button", { name: "Banco de ítems" }).click();
  await page.getByText(/ítem\(s\)/).waitFor();
  const despues = (await guardado(page)).a;
  if (despues === antes) throw new Error("el access token no se renovó");
  ok("[HU-01 c3] si el access vence a mitad del uso, la acción siguiente lo renueva y la pantalla sigue funcionando");

  // 5. Salir revoca el refresh token en el servidor.
  page = await abrir(sesiones.salir);
  await page.getByText("Qué evaluar").waitFor();
  const refresh = (await guardado(page)).r;
  await page.getByRole("button", { name: "Salir" }).click();
  await page.getByRole("button", { name: "Iniciar sesión con Google" }).waitFor();
  await new Promise((r) => setTimeout(r, 500));  // el cierre se envía sin esperar la respuesta
  const r = await fetch(`${IDENTITY}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }) });
  if (r.status !== 401) throw new Error(`el refresh token revocado respondió ${r.status}`);
  ok("[HU-01 c4] Salir revoca el refresh token: ya no sirve para renovar");

  // 6. La red cae justo al renovar: no se cierra la sesión ni se pierde el borrador, y al volver la red se publica.
  page = await conBorradorEditado(sesiones.red_caida, "Borrador que no debe perderse (red)");
  await vencerAccess(page);
  await page.route("**/auth/refresh", (r) => r.abort());
  await page.getByRole("button", { name: "Publicar 1 pregunta" }).click();
  await page.getByText(/No se pudo renovar tu sesión/).waitFor();
  await page.locator(".panel-borrador").getByText("Borrador que no debe perderse (red)").waitFor();
  g = await guardado(page);
  if (!g.a || !g.r) throw new Error("se borraron los tokens por un simple fallo de red");
  await page.unroute("**/auth/refresh");
  await page.getByRole("button", { name: "Publicar 1 pregunta" }).click();
  await page.getByText("Se publicaron 1 pregunta(s)").waitFor();
  ok("[HU-27 c4] si la red falla al renovar, no se cierra la sesión ni se pierde el borrador; al reintentar se publica");

  // 7. La sesión se pierde de verdad (refresh inválido): al volver a entrar se recupera el borrador.
  page = await conBorradorEditado(sesiones.sesion_perdida, "Borrador que sobrevive al login");
  await vencerAccess(page);
  await page.evaluate(() => localStorage.setItem("sprint1_refresh_docente", "ya-no-sirve"));
  await page.getByRole("button", { name: "Publicar 1 pregunta" }).click();
  await page.getByRole("button", { name: "Iniciar sesión con Google" }).waitFor();
  await page.getByText(/Tu sesión venció/).waitFor();
  await page.evaluate((x) => { localStorage.setItem("sprint1_token_docente", x.access); localStorage.setItem("sprint1_refresh_docente", x.refresh); }, sesiones.reentrada);
  await page.reload();  // equivale a volver de Google con una sesión nueva
  await page.getByText(/Recuperamos tu trabajo sin publicar/).waitFor();
  await page.locator(".panel-borrador").getByText("Borrador que sobrevive al login").waitFor();
  await page.getByRole("button", { name: "Publicar 1 pregunta" }).click();
  await page.getByText("Se publicaron 1 pregunta(s)").waitFor();
  await page.getByRole("button", { name: "Generar más preguntas" }).click();
  await page.reload();
  await page.getByText(/Recuperamos tu trabajo/).waitFor({ state: "detached", timeout: 3000 });
  ok("[HU-27 c4] con la sesión perdida, el borrador se recupera tras volver a entrar y, publicado, no reaparece");

  console.log(`\nOK: ${hechas} escenarios de sesión`);
} catch (e) {
  console.error("\nFALLÓ:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
