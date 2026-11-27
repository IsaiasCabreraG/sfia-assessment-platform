"use client";

// Mis evaluaciones: borradores, publicadas y descartadas. De cada una se puede continuar (borrador), duplicar o descartar.
import { useConfirmar } from "../shared/useConfirmar";
import { useCallback, useEffect, useState } from "react";
import { api, consulta } from "../shared/api";
import { Icono } from "../shared/Estrellas";
import { BUILDER_URL } from "../shared/config";
import { ErrorCarga } from "../shared/EstadoCarga";
import type { EvaluationSummary } from "../shared/types";
import { useVigencia } from "../shared/useVigencia";

type Estado = EvaluationSummary["status"];
const ESTADOS: [Estado, string][] = [["draft", "Borradores"], ["published", "Publicadas"], ["discarded", "Descartadas"]];

/** «90 min»: la duración fijada o, si todavía no se fijó, la recomendada (la suma de los minutos de los ítems). */
function duracion(e: EvaluationSummary): string {
  const minutos = e.duration_minutes ?? e.recommended_minutes;
  return minutos ? `${minutos} min` : "—";
}

export function ListaEvaluaciones({ alAbrir }: { alAbrir: (id: string | null) => void }) {
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [estado, setEstado] = useState<Estado>("draft");
  const [lista, setLista] = useState<EvaluationSummary[] | null>(null);
  const [error, setError] = useState("");

  const nueva = useVigencia();
  const cargar = useCallback(() => {
    const vigente = nueva();
    api<EvaluationSummary[]>("docente", `${BUILDER_URL}/evaluations${consulta({ status: estado })}`)
      .then((r) => { if (vigente()) { setLista(r); setError(""); } })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [estado, nueva]);

  useEffect(() => { setLista(null); cargar(); }, [cargar]);

  const duplicar = async (e: EvaluationSummary) => {
    try {
      const nueva = await api<{ id: string }>("docente", `${BUILDER_URL}/evaluations/${e.id}/duplicate`, { method: "POST", body: {} });
      alAbrir(nueva.id);
    } catch (err) { setError((err as Error).message); }
  };

  const descartar = async (e: EvaluationSummary) => {
    if (!await confirmar(`¿Descartar «${e.name}»? Dejará de aparecer entre las disponibles.`)) return;
    try {
      await api("docente", `${BUILDER_URL}/evaluations/${e.id}/discard`, { method: "POST", body: {} });
      cargar();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <section>
      {dialogoConfirmar}
      <div className="acciones entre">
        <h2 className="m-0">Mis evaluaciones</h2>
        <button className="primario" onClick={() => alAbrir(null)}>+ Nueva evaluación</button>
      </div>
      <div className="acciones">
        {ESTADOS.map(([e, texto]) => (
          <button key={e} className={estado === e ? "activa" : ""} aria-pressed={estado === e} onClick={() => setEstado(e)}>{texto}</button>
        ))}
      </div>
      {error && lista !== null && <p className="error">{error}</p>}
      {lista === null ? (error ? <ErrorCarga mensaje={error} alReintentar={() => { setError(""); cargar(); }} /> : <p className="suave">Cargando…</p>) : lista.length === 0 ? (
        <p className="suave">No hay evaluaciones {estado === "draft" ? "en borrador" : estado === "published" ? "publicadas" : "descartadas"}.</p>
      ) : (
        <ul className="lista-eval">
          {/* Los atributos van en columnas alineadas (como una matriz, pero sin líneas) y cada evaluación sigue siendo una fila. */}
          <li className="fila-evaluacion cabecera-eval" aria-hidden="true">
            <span>Evaluación</span><span>Skills</span><span>Ítems</span><span>Duración</span><span>Creada</span><span />
          </li>
          {lista.map((e) => (
            <li key={e.id} className="fila-evaluacion">
              <strong className="fila-evaluacion-nombre">{e.name}</strong>
              <span>{e.skills_count}</span>
              <span>{e.items_count}</span>
              <span>{duracion(e)}</span>
              <span>{new Date(e.created_at).toLocaleDateString("es-CL")}</span>
              <div className="acciones">
                <button className="icono-btn accion-ver" aria-label={e.status === "draft" ? "Continuar" : "Ver"} title={e.status === "draft" ? "Continuar editando" : "Ver"}
                        onClick={() => alAbrir(e.id)}><Icono nombre={e.status === "draft" ? "continuar" : "ojo"} /></button>
                <button className="icono-btn accion-duplicar" aria-label="Duplicar" title="Duplicar" onClick={() => duplicar(e)}><Icono nombre="copiar" /></button>
                {e.status !== "discarded" && (
                  <button className="icono-btn peligro" aria-label="Descartar" title="Descartar" onClick={() => descartar(e)}><Icono nombre="descartar" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
