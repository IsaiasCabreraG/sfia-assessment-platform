import { useEffect, useState } from "react";
import { listarItems } from "./api";
import type { Item, Revision } from "./tipos";

const FILTROS: { id: Revision | "todas"; nombre: string }[] = [
  { id: "pendiente", nombre: "Pendientes" },
  { id: "aprobada", nombre: "Aprobadas" },
  { id: "rechazada", nombre: "Rechazadas" },
  { id: "todas", nombre: "Todas" },
];

export default function Lista() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [filtro, setFiltro] = useState<Revision | "todas">("pendiente");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarItems().then(setItems).catch((e) => setError(e.message));
  }, []);

  const cuenta = (f: Revision | "todas") => (items ?? []).filter((i) => f === "todas" || i.revision === f).length;
  const visibles = (items ?? []).filter((i) => filtro === "todas" || i.revision === filtro);

  return (
    <>
      <h1>Revisión de expertos</h1>
      <p className="ayuda">Preguntas que los autores dejaron a disposición para validar.</p>

      <div className="filtros" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id}
            className={filtro === f.id ? "activo" : ""} onClick={() => setFiltro(f.id)}>
            {f.nombre} <span>{cuenta(f.id)}</span>
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!items && !error && <p>Cargando…</p>}
      {items && visibles.length === 0 && <p className="ayuda">No hay preguntas en esta vista.</p>}

      <ul className="lista-preguntas">
        {visibles.map((i) => (
          <li key={i.id}>
            <a href={`#/pregunta/${encodeURIComponent(i.id)}`}>
              <span className="meta">
                <b>{i.skill}</b> · nivel {i.nivel} · {i.tipo} · {i.dificultad} · {i.tiempo_min} min
              </span>
              <span className="extracto">{i.enunciado}</span>
              <span className={`estado ${i.revision}`}>{i.revision}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
