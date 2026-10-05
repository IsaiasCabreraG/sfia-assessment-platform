/**
 * Módulo backend de la PoC (Node + Express + TypeScript, SQL directo con pg).
 *
 * Mismo contrato que las variantes de FastAPI: valida el JWT HS256 emitido por el módulo de
 * autenticación, registra al usuario en `users` la primera vez que lo ve, y expone
 * `GET /items`, `POST /items`, `POST /ai/ask` y `GET /health`. Es el único módulo de la PoC
 * que accede a la base de datos.
 *
 * Cómo probarlo (desde la raíz del repositorio). Requiere la BD levantada y, para /ai/ask,
 * el módulo LLM en el puerto 8002. Detén antes las otras variantes del backend (todas usan el 8000):
 *
 *     bash poc/backend/node/pg/run.sh        # instala dependencias, crea .env y arranca
 *
 * Node 24 ejecuta TypeScript directamente (`node main.ts`): borra los tipos y corre el
 * JavaScript resultante, sin compilar. No comprueba los tipos; para eso:
 *
 *     cd poc/backend/node/pg && npm run typecheck
 *
 * Prueba automática (desde la raíz del repositorio):
 *
 *     python3 poc/tests/smoke_test.py
 *
 * Prueba manual: saca un token en http://localhost:8001/auth/login y:
 *
 *     TOKEN=<access_token>
 *     curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN"
 *     curl -s localhost:8000/items -H "Authorization: Bearer $TOKEN" \
 *         -H 'Content-Type: application/json' -d '{"titulo":"Prueba","descripcion":"Primer ítem"}'
 *     curl -s localhost:8000/ai/ask -H "Authorization: Bearer $TOKEN" \
 *         -H 'Content-Type: application/json' -d '{"prompt":"Di hola en una frase"}'
 */
import { readFileSync } from "node:fs";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import pg from "pg";

function entorno(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

const JWT_SECRET = new TextEncoder().encode(entorno("JWT_SECRET"));
const LLM_URL = process.env.LLM_URL ?? "http://localhost:8002";
const LLM_TIMEOUT_SECONDS = Number(process.env.LLM_TIMEOUT_SECONDS ?? "130");
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:8001";
const PORT = Number(process.env.PORT ?? "8000");

// BIGINT (int8) llega como texto por defecto; se convierte a número para igualar el contrato
// de las otras variantes.
pg.types.setTypeParser(pg.types.builtins.INT8, (valor: string) => Number(valor));

// A diferencia de la variante psycopg (una conexión por operación), el Pool reutiliza conexiones.
const pool = new pg.Pool({
  host: process.env.POC_DB_HOST ?? "localhost",
  port: Number(process.env.POC_DB_PORT ?? "5432"),
  database: entorno("POC_DB_NAME"),
  user: entorno("POC_DB_USER"),
  password: entorno("POC_DB_PASSWORD"),
});

interface Usuario {
  id: number;
  email: string;
  nombre: string;
}

function versionDe(paquete: string): string {
  const ruta = new URL(`./node_modules/${paquete}/package.json`, import.meta.url);
  return JSON.parse(readFileSync(ruta, "utf-8")).version;
}

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, methods: ["GET", "POST"], allowedHeaders: ["Authorization", "Content-Type"] }));
app.use(express.json());

function saludPropia(): Record<string, unknown> {
  return {
    modulo: "backend",
    variante: "node-pg",
    versiones: {
      node: process.versions.node,
      express: versionDe("express"),
      pg: versionDe("pg"),
      jose: versionDe("jose"),
    },
  };
}

app.get("/health", (_req: Request, res: Response) => {
  res.json(saludPropia());
});

/** Consulta el /health de otro módulo; si no responde, lo indica en vez de fallar. */
async function saludDe(modulo: string, url: string): Promise<Record<string, unknown>> {
  try {
    const respuesta = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    return (await respuesta.json()) as Record<string, unknown>;
  } catch {
    return { modulo, variante: null, error: "sin respuesta" };
  }
}

/** Variante y versiones de los módulos de la PoC, para identificar qué se está probando. */
app.get("/modulos", async (_req: Request, res: Response) => {
  let bd: Record<string, unknown>;
  try {
    const resultado = await pool.query<{ server_version: string }>("SHOW server_version");
    const version = resultado.rows[0].server_version.split(" ")[0];
    bd = { modulo: "db", variante: "postgresql", versiones: { postgresql: version } };
  } catch {
    bd = { modulo: "db", variante: null, error: "sin respuesta" };
  }
  const [llm, auth] = await Promise.all([saludDe("llm", LLM_URL), saludDe("auth", AUTH_URL)]);
  res.json([saludPropia(), llm, auth, bd]);
});

/** Valida el JWT y deja en `res.locals.user` la fila de `users`, creándola la primera vez. */
async function usuarioActual(req: Request, res: Response, next: NextFunction): Promise<void> {
  const autorizacion = req.header("authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Falta el token" });
    return;
  }
  let sub: string;
  let email: string;
  let nombre: string;
  try {
    const { payload } = await jwtVerify(autorizacion.slice("Bearer ".length), JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.nombre !== "string"
    ) {
      throw new Error("Faltan datos en el token");
    }
    ({ sub, email, nombre } = { sub: payload.sub, email: payload.email, nombre: payload.nombre });
  } catch {
    res.status(401).json({ detail: "Token inválido o expirado" });
    return;
  }

  let resultado = await pool.query<Usuario>(
    "SELECT id, email, nombre FROM users WHERE google_id = $1",
    [sub],
  );
  if (resultado.rows.length === 0) {
    resultado = await pool.query<Usuario>(
      "INSERT INTO users (email, nombre, google_id) VALUES ($1, $2, $3) RETURNING id, email, nombre",
      [email, nombre, sub],
    );
  }
  res.locals.user = resultado.rows[0];
  next();
}

app.get("/items", usuarioActual, async (_req: Request, res: Response) => {
  const resultado = await pool.query(
    "SELECT i.id, i.titulo, i.descripcion, u.nombre AS creado_por, i.creado_en" +
      " FROM items i JOIN users u ON u.id = i.creado_por ORDER BY i.id DESC",
  );
  res.json(resultado.rows);
});

app.post("/items", usuarioActual, async (req: Request, res: Response) => {
  const { titulo, descripcion } = req.body ?? {};
  const descripcionValida =
    descripcion === undefined || descripcion === null || typeof descripcion === "string";
  if (typeof titulo !== "string" || !descripcionValida) {
    res.status(422).json({
      detail: "'titulo' (texto) es obligatorio y 'descripcion' debe ser texto o null",
    });
    return;
  }
  const usuario = res.locals.user as Usuario;
  const resultado = await pool.query(
    "INSERT INTO items (titulo, descripcion, creado_por) VALUES ($1, $2, $3)" +
      " RETURNING id, titulo, descripcion, creado_en",
    [titulo, descripcion ?? null, usuario.id],
  );
  res.status(201).json(resultado.rows[0]);
});

app.post("/ai/ask", usuarioActual, async (req: Request, res: Response) => {
  const { prompt } = req.body ?? {};
  if (typeof prompt !== "string") {
    res.status(422).json({ detail: "'prompt' (texto) es obligatorio" });
    return;
  }
  let respuesta: globalThis.Response;
  try {
    respuesta = await fetch(`${LLM_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_SECONDS * 1000),
    });
  } catch {
    res.status(502).json({ detail: "No se pudo contactar al módulo LLM" });
    return;
  }
  if (respuesta.status !== 200) {
    res.status(502).json({ detail: `El módulo LLM respondió ${respuesta.status}` });
    return;
  }
  res.json(await respuesta.json());
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const estado =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;
  if (estado >= 500) {
    console.error(err);
  }
  res.status(estado).json({ detail: estado >= 500 ? "Error interno del servidor" : "Petición inválida" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend Node escuchando en http://localhost:${PORT}`);
});
