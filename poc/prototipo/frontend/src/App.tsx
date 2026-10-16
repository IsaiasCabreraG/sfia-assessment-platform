import { useEffect, useState } from "react";
import { generar, guardarRol, obtenerCatalogo } from "./api";
import PasoQueEvaluar from "./PasoQueEvaluar";
import { PasoContexto, PasoResumen } from "./Pasos";
import Revision from "./Revision";
import type { Borrador, Catalogo, Formulario, Bloque } from "./tipos";
import { formularioInicial } from "./tipos";

const PASOS = ["Qué evaluar", "Contexto", "Resumen y generación"];

// Devuelve el motivo por el que no se puede avanzar, o null si el paso está completo.
function errorDelPaso(paso: number, f: Formulario): string | null {
  if (paso === 0) {
    if (f.bloques.length === 0) return "Añade al menos una skill (o carga un rol).";
    for (const b of f.bloques) {
      if (b.tipos.length === 0) return `${b.codigo}: elige al menos un tipo de ejercicio.`;
      if (b.tipos.some((t) => t.cantidad < 1)) return `${b.codigo}: la cantidad por tipo debe ser al menos 1.`;
      if (b.tiempo_min < 1) return `${b.codigo}: el tiempo por ítem debe ser al menos 1 minuto.`;
    }
  }
  return null;
}

export default function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [f, setF] = useState<Formulario>(formularioInicial);
  const [paso, setPaso] = useState(0);
  const [borradores, setBorradores] = useState<Borrador[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCatalogo().then(setCatalogo).catch((e) => setError(`No se pudo cargar el catálogo: ${e.message}`));
  }, []);

  const cambiar = (parcial: Partial<Formulario>) => setF((x) => ({ ...x, ...parcial }));

  async function guardarComoRol(nombre: string, bloques: Bloque[]) {
    try {
      setError(null);
      const rol = await guardarRol(nombre, bloques);
      setCatalogo((c) => (c ? { ...c, roles: [...c.roles, rol] } : c));
      cambiar({ rol: rol.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function siguiente() {
    const e = errorDelPaso(paso, f);
    setError(e);
    if (!e) setPaso(paso + 1);
  }

  async function lanzarGeneracion() {
    setCargando(true);
    setError(null);
    try {
      setBorradores(await generar(f));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  if (borradores) {
    return (
      <main>
        <Revision formulario={f} borradores={borradores} onCambio={setBorradores} onVolver={() => setBorradores(null)} />
      </main>
    );
  }

  return (
    <main>
      <h1>Generar preguntas</h1>
      <ol className="pasos">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? "activo" : i < paso ? "hecho" : ""}>
            <button type="button" disabled={i > paso} onClick={() => setPaso(i)}>
              <span>{i + 1}</span> {p}
            </button>
          </li>
        ))}
      </ol>

      {!catalogo ? (
        <p>Cargando catálogo…</p>
      ) : (
        <section className="tarjeta">
          {paso === 0 && <PasoQueEvaluar f={f} catalogo={catalogo} cambiar={cambiar} onGuardarRol={guardarComoRol} />}
          {paso === 1 && <PasoContexto f={f} cambiar={cambiar} onError={setError} />}
          {paso === 2 && <PasoResumen f={f} cambiar={cambiar} irA={setPaso} />}
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="acciones">
        {paso > 0 && <button type="button" className="sec" onClick={() => setPaso(paso - 1)} disabled={cargando}>Atrás</button>}
        {paso < 2 ? (
          <button type="button" onClick={siguiente} disabled={!catalogo}>Siguiente</button>
        ) : (
          <button type="button" onClick={lanzarGeneracion} disabled={cargando}>
            {cargando ? "Generando… (puede tardar un minuto)" : "Generar"}
          </button>
        )}
      </div>
    </main>
  );
}
