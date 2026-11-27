// Cliente HTTP mínimo: agrega el JWT a cada llamada y convierte los errores del backend en excepciones.
import { avisarSesionVencida, cerrarSesion, leerToken, refrescarSesion, type Portal } from "./auth";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, mensaje: string, body: unknown) {
    super(mensaje);
    this.status = status;
    this.body = body;
  }
}

/**
 * Llama al backend con el JWT. Si responde 401 (access token vencido) renueva la sesión con el refresh token
 * y repite la llamada una vez; si no se puede renovar, cierra la sesión y vuelve a la pantalla de acceso.
 */
export async function api<T>(portal: Portal, url: string, opciones: { method?: string; body?: unknown } = {}, reintento = false): Promise<T> {
  const token = leerToken(portal);
  const resp = await fetch(url, {
    method: opciones.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await resp.json().catch(() => null);
  if (resp.status === 401 && !reintento) {
    const renovacion = await refrescarSesion(portal);
    if (renovacion === "ok") return api<T>(portal, url, opciones, true);
    if (renovacion === "error")
      // No se pudo consultar al servidor: la sesión puede seguir siendo válida. No se cierra nada.
      throw new ApiError(0, "No se pudo renovar tu sesión (sin respuesta del servidor). Tu trabajo sigue en pantalla: reintenta en unos segundos.", null);
    avisarSesionVencida(portal);
    cerrarSesion(portal);
    window.location.reload(); // el refresh token ya no sirve: LoginGate muestra el acceso con Google
  }
  if (!resp.ok) {
    // Los errores de negocio traen `detail`; la generación fallida (502) trae `error`.
    const detalle = typeof datos?.detail === "string" ? datos.detail : datos?.error;
    throw new ApiError(resp.status, detalle ?? `Error ${resp.status}`, datos);
  }
  return datos as T;
}

/** Arma `?a=1&b=2` omitiendo los valores vacíos. */
export function consulta(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
