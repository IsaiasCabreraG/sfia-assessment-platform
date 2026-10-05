/**
 * Prueba E2E de la interfaz de la PoC: abre el frontend en un navegador real (Chromium sin ventana)
 * y hace lo que haría una persona. Sirve para cualquier frontend (React o Vue) y cualquier backend.
 *
 * Requiere corriendo: la BD, un backend (8000), un frontend (5173) y, para la prueba de la IA, el LLM (8002).
 * Se ejecuta con `bash poc/tests/e2e/run.sh` (desde la raíz del repositorio).
 *
 * El login con Google no se automatiza: la prueba fabrica un token con el JWT_SECRET y lo deja en el
 * localStorage antes de abrir la página.
 *
 * Contrato de interfaz que debe cumplir cualquier frontend para pasar esta prueba:
 *   - localStorage "poc_token" guarda el JWT y, si existe, se muestra el panel (no el login).
 *   - El panel muestra el nombre del usuario.
 *   - Campos con placeholder "Título", "Descripción" y "Escribe tu consulta".
 *   - Botones "Guardar" y "Preguntar".
 *   - Cada ítem de la tabla es una fila <tr> con su título y quién lo creó.
 *   - La respuesta de la IA se muestra en un elemento con la clase "respuesta"; los errores, con la clase "error".
 *   - Una sección con el título "Módulos bajo prueba" que lista los módulos y sus variantes.
 */
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// Se ejecuta desde poc/tests/e2e (run.sh), así que poc/ queda dos niveles más arriba.
const POC = resolve(process.cwd(), "../..");
const GOOGLE_ID_PRUEBA = "e2e-test";
const NOMBRE_PRUEBA = "E2E Test";
const TOKEN_KEY = "poc_token";

function leerEnv(ruta: string): Record<string, string> {
  const valores: Record<string, string> = {};
  if (!existsSync(ruta)) return valores;
  for (const linea of readFileSync(ruta, "utf-8").split("\n")) {
    const texto = linea.trim();
    if (!texto || texto.startsWith("#") || !texto.includes("=")) continue;
    const i = texto.indexOf("=");
    valores[texto.slice(0, i).trim()] = texto.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return valores;
}

function fabricarToken(secreto: string): string {
  const b64 = (dato: string | Buffer) => Buffer.from(dato).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const encabezado = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const datos = b64(
    JSON.stringify({
      sub: GOOGLE_ID_PRUEBA,
      email: "e2e@test.local",
      nombre: NOMBRE_PRUEBA,
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const firma = createHmac("sha256", secreto).update(`${encabezado}.${datos}`).digest("base64url");
  return `${encabezado}.${datos}.${firma}`;
}

const secreto =
  process.env.JWT_SECRET ?? leerEnv(resolve(POC, "auth/authlib/.env")).JWT_SECRET;
if (!secreto) {
  throw new Error("No se encontró JWT_SECRET (variable de entorno o poc/auth/authlib/.env)");
}
const token = fabricarToken(secreto);

/** Borra el usuario de prueba y sus ítems (usa psql con poc/db/.env). */
function limpiarBd(): void {
  const env = leerEnv(resolve(POC, "db/.env"));
  const sql =
    "DELETE FROM items WHERE creado_por IN" +
    ` (SELECT id FROM users WHERE google_id = '${GOOGLE_ID_PRUEBA}');` +
    ` DELETE FROM users WHERE google_id = '${GOOGLE_ID_PRUEBA}';`;
  try {
    execFileSync(
      "psql",
      [
        "-h", env.POC_DB_HOST ?? "localhost",
        "-p", env.POC_DB_PORT ?? "5432",
        "-U", env.POC_DB_USER,
        "-d", env.POC_DB_NAME,
        "-v", "ON_ERROR_STOP=1",
        "-c", sql,
      ],
      { env: { ...process.env, PGPASSWORD: env.POC_DB_PASSWORD }, stdio: "pipe" },
    );
  } catch (e) {
    console.warn(
      `Aviso: no se pudo limpiar la BD (${(e as Error).message}). ` +
        `Borra a mano el usuario con google_id '${GOOGLE_ID_PRUEBA}' y sus ítems.`,
    );
  }
}

test.afterAll(() => {
  limpiarBd();
});

test.beforeEach(async ({ page }) => {
  // Saltar el login: dejar el token en el localStorage antes de que cargue la página.
  await page.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [TOKEN_KEY, token]);
  await page.goto("/");
});

test("muestra el panel con el usuario y el recuadro de módulos", async ({ page }) => {
  await expect(page.getByText(NOMBRE_PRUEBA)).toBeVisible();
  const recuadro = page.locator("section", {
    has: page.getByRole("heading", { name: "Módulos bajo prueba" }),
  });
  await expect(recuadro).toContainText("frontend");
  await expect(recuadro).toContainText("backend");
  await expect(recuadro).toContainText("postgresql");
});

test("crear un ítem con el formulario lo muestra en la tabla", async ({ page }) => {
  const titulo = `Prueba e2e ${Date.now()}`;
  await page.getByPlaceholder("Título").fill(titulo);
  await page.getByPlaceholder("Descripción").fill("creado por la prueba e2e");
  await page.getByRole("button", { name: "Guardar" }).click();

  const fila = page.locator("tr", { hasText: titulo });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText(NOMBRE_PRUEBA);
  await expect(page.locator(".error")).toHaveCount(0);
});

test("la consulta a la IA muestra una respuesta", async ({ page }) => {
  // La CLI del LLM tarda varios segundos.
  test.setTimeout(150_000);
  await page.getByPlaceholder("Escribe tu consulta").fill("Responde solo con la palabra: listo");
  await page.getByRole("button", { name: "Preguntar" }).click();

  await expect(page.locator(".respuesta")).not.toBeEmpty({ timeout: 140_000 });
  await expect(page.locator(".error")).toHaveCount(0);
});
