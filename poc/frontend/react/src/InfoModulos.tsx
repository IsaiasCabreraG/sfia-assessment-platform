import { useEffect, useState } from "react";

interface Salud {
  modulo: string;
  variante: string | null;
  versiones?: Record<string, string>;
  comando?: string;
  cwd?: string;
  error?: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

function detalle(salud: Salud): string {
  const versiones = Object.entries(salud.versiones ?? {})
    .map(([paquete, version]) => `${paquete} ${version}`)
    .join(", ");
  const extras = [
    salud.comando && `comando: ${salud.comando}`,
    salud.cwd && `cwd: ${salud.cwd}`,
  ].filter(Boolean);
  return [versiones, ...extras].join(" · ");
}

async function leerJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Recuadro con la variante y las versiones de cada módulo que se está probando. */
export default function InfoModulos() {
  const [filas, setFilas] = useState<Salud[] | null>(null);

  async function consultar() {
    setFilas(null);
    // El frontend publica su propia identidad; la del resto la reúne el backend en GET /modulos.
    const [propio, restantes] = await Promise.all([
      leerJson<Salud>("/health.json"),
      leerJson<Salud[]>(`${BACKEND_URL}/modulos`),
    ]);
    setFilas([
      propio ?? { modulo: "frontend", variante: null, error: "sin respuesta" },
      ...(restantes ?? [{ modulo: "backend", variante: null, error: "sin respuesta" }]),
    ]);
  }

  useEffect(() => {
    consultar();
  }, []);

  return (
    <section>
      <h2>Módulos bajo prueba</h2>
      <button onClick={consultar}>Actualizar</button>
      <table>
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Variante</th>
            <th>Versiones</th>
          </tr>
        </thead>
        <tbody>
          {filas === null ? (
            <tr>
              <td colSpan={3}>consultando…</td>
            </tr>
          ) : (
            filas.map((m) => (
              <tr key={m.modulo}>
                <td>{m.modulo}</td>
                {m.variante === null ? (
                  <td colSpan={2}>{m.error ?? "sin respuesta"} (¿no está corriendo?)</td>
                ) : (
                  <>
                    <td>{m.variante}</td>
                    <td>{detalle(m)}</td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
