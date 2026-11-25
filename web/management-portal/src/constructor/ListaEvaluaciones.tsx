"use client";

// Mis evaluaciones: borradores, publicadas y descartadas. De cada una se puede continuar (borrador), duplicar o descartar.
import { useCallback, useEffect, useState } from "react";
import { api, consulta } from "../shared/api";
import { BUILDER_URL } from "../shared/config";
import type { EvaluationSummary } from "../shared/types";

type Estado = EvaluationSummary["status"];
const ESTADOS: [Estado, string][] = [["draft", "Borradores"], ["published", "Publicadas"], ["discarded", "Descartadas"]];
const ETIQUETA: Record<Estado, string> = { draft: "borrador", published: "publicada", discarded: "descartada" };

/** «90 min (rec. 96)»: la duración fijada y, si difiere, la recomendada (suma de los minutos de los ítems). */
function duracion(e: EvaluationSummary): string {
  if (e.duration_minutes == null) return e.recommended_minutes ? `— (rec. ${e.recommended_minutes} min)` : "—";
  return e.recommended_minutes && e.recommended_minutes !== e.duration_minutes
    ? `${e.duration_minutes} min (rec. ${e.recommended_minutes})` : `${e.duration_minutes} min`;
}

export function ListaEvaluaciones({ alAbrir }: { alAbrir: (id: string | null) => void }) {
  const [estado, setEstado] = useState<Estado>("draft");
  const [lista, setLista] = useState<EvaluationSummary[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    api<EvaluationSummary[]>("docente", `${BUILDER_URL}/evaluations${consulta({ status: estado })}`)
      .then((r) => { setLista(r); setError(""); })
      .catch((e) => setError(e.message));
  }, [estado]);

  useEffect(() => { setLista(null); cargar(); }, [cargar]);

  const duplicar = async (e: EvaluationSummary) => {
    try {
      const nueva = await api<{ id: string }>("docente", `${BUILDER_URL}/evaluations/${e.id}/duplicate`, { method: "POST", body: {} });
      alAbrir(nueva.id);
    } catch (err) { setError((err as Error).message); }
  };

  const descartar = async (e: EvaluationSummary) => {
    if (!window.confirm(`¿Descartar «${e.name}»? Dejará de aparecer entre las disponibles.`)) return;
    try {
      await api("docente", `${BUILDER_URL}/evaluations/${e.id}/discard`, { method: "POST", body: {} });
      cargar();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <section>
      <div className="acciones" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Mis evaluaciones</h2>
        <button className="primario" onClick={() => alAbrir(null)}>+ Nueva evaluación</button>
      </div>
      <div className="acciones">
        {ESTADOS.map(([e, texto]) => (
          <button key={e} className={estado === e ? "activa" : ""} aria-pressed={estado === e} onClick={() => setEstado(e)}>{texto}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {lista === null ? <p className="suave">Cargando…</p> : lista.length === 0 ? (
        <p className="suave">No hay evaluaciones {estado === "draft" ? "en borrador" : estado === "published" ? "publicadas" : "descartadas"}.</p>
      ) : (
        <table className="tabla-eval">
          <thead><tr><th>Nombre</th><th>Estado</th><th>Skills</th><th>Ítems</th><th>Duración</th><th>Creada</th><th /></tr></thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.name}</strong></td>
                <td><span className="etiqueta">{ETIQUETA[e.status]}</span></td>
                <td>{e.skills_count}</td>
                <td>{e.items_count}</td>
                <td>{duracion(e)}</td>
                <td>{new Date(e.created_at).toLocaleDateString("es-CL")}</td>
                <td className="acciones">
                  <button onClick={() => alAbrir(e.id)}>{e.status === "draft" ? "Continuar" : "Ver"}</button>
                  <button onClick={() => duplicar(e)}>Duplicar</button>
                  {e.status !== "discarded" && <button className="peligro" onClick={() => descartar(e)}>Descartar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
