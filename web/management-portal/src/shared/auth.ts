// Sesión del portal. Tras el login con Google llegan dos tokens en el fragmento de la URL:
//  - access token (JWT, dura 1 hora): se manda en cada llamada al backend.
//  - refresh token (opaco, dura 7 días y sirve una sola vez): se cambia por un par nuevo cuando el access vence.
// Ambos se guardan en localStorage, con una clave por portal para poder tener los dos portales abiertos.
import { IDENTITY_URL } from "./config";

export type Portal = "docente" | "validador";

const claveAccess = (portal: Portal) => `sprint1_token_${portal}`;
const claveRefresh = (portal: Portal) => `sprint1_refresh_${portal}`;

/** Si la URL trae `#access_token=...&refresh_token=...`, los guarda y limpia la URL. */
export function guardarTokenDeLaUrl(portal: Portal): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const access = params.get("access_token");
  if (access) {
    guardarTokens(portal, access, params.get("refresh_token"));
    window.history.replaceState(null, "", window.location.pathname);
  }
}

function guardarTokens(portal: Portal, access: string, refresh: string | null): void {
  localStorage.setItem(claveAccess(portal), access);
  if (refresh) localStorage.setItem(claveRefresh(portal), refresh);
}

export function leerToken(portal: Portal): string | null {
  return localStorage.getItem(claveAccess(portal));
}

/** Cierra la sesión: revoca el refresh token en el servidor (sin esperar la respuesta) y borra los tokens locales. */
export function cerrarSesion(portal: Portal): void {
  const refresh = localStorage.getItem(claveRefresh(portal));
  if (refresh) {
    fetch(`${IDENTITY_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      keepalive: true, // sigue aunque la página se recargue enseguida
    }).catch(() => {});
  }
  localStorage.removeItem(claveAccess(portal));
  localStorage.removeItem(claveRefresh(portal));
}

// Si varias llamadas fallan a la vez por el token vencido, se renueva una sola vez: el refresh token
// sirve una sola vez, así que una segunda renovación en paralelo lo invalidaría.
const renovaciones = new Map<Portal, Promise<ResultadoRenovacion>>();

/** "ok": sesión renovada. "invalida": el servidor rechazó el refresh token (vencido o revocado): hay que volver a entrar.
 *  "error": no se pudo consultar al servidor (red caída o falla del servidor): la sesión puede seguir siendo válida. */
export type ResultadoRenovacion = "ok" | "invalida" | "error";

/** Cambia el refresh token por un par nuevo. */
export function refrescarSesion(portal: Portal): Promise<ResultadoRenovacion> {
  const enCurso = renovaciones.get(portal);
  if (enCurso) return enCurso;
  const refresh = localStorage.getItem(claveRefresh(portal));
  if (!refresh) return Promise.resolve("invalida");
  const promesa = fetch(`${IDENTITY_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  })
    .then(async (resp): Promise<ResultadoRenovacion> => {
      if (resp.ok) {
        const datos = await resp.json();
        guardarTokens(portal, datos.access_token, datos.refresh_token);
        return "ok";
      }
      return resp.status >= 500 ? "error" : "invalida";
    })
    .catch((): ResultadoRenovacion => "error")
    .finally(() => renovaciones.delete(portal));
  renovaciones.set(portal, promesa);
  return promesa;
}

/** Roles que trae el JWT (se leen sin verificar la firma: solo para decidir qué pantalla mostrar). */
export function rolesDelToken(token: string): string[] {
  try {
    const cuerpo = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(cuerpo)).roles ?? [];
  } catch {
    return [];
  }
}

/** Redirige al login con Google (módulo identity) indicando a qué portal volver. */
export function iniciarLogin(portal: Portal): void {
  window.location.href = `${IDENTITY_URL}/auth/login?portal=${portal}`;
}

// Aviso para la pantalla de acceso cuando la sesión se perdió sin que el usuario la cerrara.
const claveAviso = (portal: Portal) => `sprint1_aviso_${portal}`;
export const avisarSesionVencida = (portal: Portal) => localStorage.setItem(claveAviso(portal), "1");
export function leerAvisoSesionVencida(portal: Portal): boolean {
  const hay = localStorage.getItem(claveAviso(portal)) !== null;
  localStorage.removeItem(claveAviso(portal));
  return hay;
}
