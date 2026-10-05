import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import InfoModulos from "./InfoModulos";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";
const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:8001";
const TOKEN_KEY = "poc_token";

interface Item {
  id: number;
  titulo: string;
  descripcion: string | null;
  creado_por: string;
  creado_en: string;
}

declare global {
  interface Window {
    // Script de Google Identity Services (se carga si el módulo de autenticación activo es google-auth).
    google?: any;
  }
}

function leerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Nombre del usuario, leído del JWT solo para mostrarlo (la verificación la hace el backend). */
function nombreDelToken(token: string): string {
  try {
    const cuerpo = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).nombre ?? "usuario";
  } catch {
    return "usuario";
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    // Con el login por redirección (authlib), el módulo devuelve el token en #access_token=...
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recibido = hash.get("access_token");
    if (recibido) {
      localStorage.setItem(TOKEN_KEY, recibido);
      history.replaceState(null, "", window.location.pathname);
      return recibido;
    }
    return leerToken();
  });

  function cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!token) {
    return <Login onToken={setToken} />;
  }
  return <Panel token={token} onCerrarSesion={cerrarSesion} />;
}

/** Datos del módulo de autenticación activo, tal como los informa su /health (vía GET /modulos del backend). */
interface Autenticacion {
  variante: string;
  google_client_id?: string;
}

type Deteccion = "detectando" | "sin-backend" | "sin-auth" | Autenticacion;

/** Averigua qué módulo de autenticación está corriendo; el botón de login depende de eso. */
async function detectarAutenticacion(): Promise<Deteccion> {
  try {
    const r = await fetch(`${BACKEND_URL}/modulos`);
    if (!r.ok) return "sin-backend";
    const modulos = (await r.json()) as { modulo: string; variante: string | null; google_client_id?: string }[];
    const auth = modulos.find((m) => m.modulo === "auth");
    if (!auth || !auth.variante) return "sin-auth";
    return { variante: auth.variante, google_client_id: auth.google_client_id };
  } catch {
    return "sin-backend";
  }
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const botonGoogle = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<Deteccion>("detectando");
  const [scriptCargado, setScriptCargado] = useState(false);

  async function detectar() {
    setError("");
    setAuth("detectando");
    setAuth(await detectarAutenticacion());
  }

  useEffect(() => {
    detectar();
  }, []);

  // Botón de Google: solo si el módulo de autenticación activo es google-auth.
  useEffect(() => {
    if (typeof auth === "string" || auth.variante !== "google-auth") return;
    const clienteId = auth.google_client_id;
    if (!clienteId) {
      setError("El módulo google-auth no informó su ID de cliente de Google.");
      return;
    }
    setScriptCargado(false);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onerror = () => setError("No se pudo cargar el script de Google (¿sin conexión o bloqueado?).");
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: clienteId,
        callback: async (respuesta: { credential: string }) => {
          let r: Response;
          try {
            r = await fetch(`${AUTH_URL}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_token: respuesta.credential }),
            });
          } catch {
            setError(`No se pudo contactar al módulo de autenticación en ${AUTH_URL}.`);
            return;
          }
          if (!r.ok) {
            setError(`El módulo de autenticación respondió ${r.status}.`);
            return;
          }
          const { access_token } = await r.json();
          localStorage.setItem(TOKEN_KEY, access_token);
          onToken(access_token);
        },
      });
      window.google.accounts.id.renderButton(botonGoogle.current, { theme: "outline", size: "large" });
      setScriptCargado(true);
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [auth, onToken]);

  let acceso;
  if (auth === "detectando") {
    acceso = <p>Detectando el módulo de autenticación…</p>;
  } else if (auth === "sin-backend") {
    acceso = (
      <p className="error">
        No se pudo consultar al backend en {BACKEND_URL} para detectar la autenticación (¿está corriendo?).
        {window.location.hostname !== "localhost" && (
          <>
            {" "}
            Estás abriendo la página en {window.location.origin}: ábrela en http://localhost:5173, que es el
            origen autorizado por el backend y por Google.
          </>
        )}
      </p>
    );
  } else if (auth === "sin-auth") {
    acceso = <p className="error">El módulo de autenticación no responde (¿está corriendo en {AUTH_URL}?).</p>;
  } else if (auth.variante === "authlib") {
    acceso = (
      <button onClick={() => (window.location.href = `${AUTH_URL}/auth/login`)}>
        Iniciar sesión con Google
      </button>
    );
  } else if (auth.variante === "google-auth") {
    acceso = (
      <>
        <div ref={botonGoogle} />
        {!scriptCargado && !error && <p>Cargando el botón de Google…</p>}
        {scriptCargado && (
          <p>
            Si Google rechaza el acceso al pulsar el botón, comprueba que <code>{window.location.origin}</code> esté
            en «Orígenes autorizados de JavaScript» del cliente OAuth (Google Cloud Console).
          </p>
        )}
      </>
    );
  } else {
    acceso = <p className="error">Variante de autenticación no soportada: {auth.variante}.</p>;
  }

  return (
    <main>
      <h1>PoC - Frontend (React)</h1>
      <p>Inicia sesión para continuar.</p>
      {typeof auth !== "string" && (
        <p>
          Módulo de autenticación detectado: <strong>{auth.variante}</strong>
        </p>
      )}
      {acceso}
      {(auth === "sin-backend" || auth === "sin-auth") && <button onClick={detectar}>Reintentar</button>}
      {error && <p className="error">{error}</p>}
      <InfoModulos />
    </main>
  );
}

function Panel({ token, onCerrarSesion }: { token: string; onCerrarSesion: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [errorTabla, setErrorTabla] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [prompt, setPrompt] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [errorIA, setErrorIA] = useState("");
  const [consultando, setConsultando] = useState(false);

  /** Llama al backend con el JWT; si responde 401, cierra la sesión. */
  async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${BACKEND_URL}${ruta}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
    if (r.status === 401) {
      onCerrarSesion();
      throw new Error("La sesión expiró");
    }
    if (!r.ok) {
      throw new Error(`El backend respondió ${r.status}`);
    }
    return r.json();
  }

  async function cargarItems() {
    try {
      setItems(await api<Item[]>("/items"));
      setErrorTabla("");
    } catch (e) {
      setErrorTabla((e as Error).message);
    }
  }

  useEffect(() => {
    cargarItems();
  }, []);

  async function crearItem(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/items", {
        method: "POST",
        body: JSON.stringify({ titulo, descripcion: descripcion || null }),
      });
      setTitulo("");
      setDescripcion("");
      setErrorForm("");
      await cargarItems();
    } catch (err) {
      setErrorForm((err as Error).message);
    }
  }

  async function preguntar(e: FormEvent) {
    e.preventDefault();
    setConsultando(true);
    setRespuesta("");
    try {
      const { answer } = await api<{ answer: string }>("/ai/ask", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setRespuesta(answer);
      setErrorIA("");
    } catch (err) {
      setErrorIA((err as Error).message);
    } finally {
      setConsultando(false);
    }
  }

  return (
    <main>
      <header>
        <h1>PoC - Frontend (React)</h1>
        <span>
          {nombreDelToken(token)} <button onClick={onCerrarSesion}>Cerrar sesión</button>
        </span>
      </header>

      <section>
        <h2>Ítems</h2>
        <button onClick={cargarItems}>Actualizar</button>
        {errorTabla && <p className="error">{errorTabla}</p>}
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Título</th>
              <th>Descripción</th>
              <th>Creado por</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>{i.titulo}</td>
                <td>{i.descripcion}</td>
                <td>{i.creado_por}</td>
                <td>{new Date(i.creado_en).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Nuevo ítem</h2>
        <form onSubmit={crearItem}>
          <input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          <input
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <button type="submit">Guardar</button>
        </form>
        {errorForm && <p className="error">{errorForm}</p>}
      </section>

      <section>
        <h2>Consulta a la IA</h2>
        <form onSubmit={preguntar}>
          <textarea
            placeholder="Escribe tu consulta"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
          <button type="submit" disabled={consultando}>
            {consultando ? "Consultando… (puede tardar unos segundos)" : "Preguntar"}
          </button>
        </form>
        {errorIA && <p className="error">{errorIA}</p>}
        {respuesta && <p className="respuesta">{respuesta}</p>}
      </section>

      <InfoModulos />
    </main>
  );
}
