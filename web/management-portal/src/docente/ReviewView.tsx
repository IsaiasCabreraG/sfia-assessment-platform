"use client";

// Revisión de borradores (HU-04): el autor edita, regenera o descarta cada borrador y recién entonces publica.
// Los borradores viven solo en pantalla; "Publicar" los guarda en el banco (versión 1, activos, sin puntuar).
import { useState } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import type { Draft } from "../shared/types";
import { DraftEditor } from "./DraftEditor";

interface Props {
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  fallos: { etiqueta: string; mensaje: string }[];
  alPublicar: (cantidad: number) => void;
}

/** Quita lo que el usuario dejó vacío al editar (líneas, alternativas y hallazgos en blanco). */
function limpiar(c: Record<string, any>): Record<string, any> {
  const lista = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);
  const r = { ...c };
  for (const k of ["functional_requirements", "non_functional_requirements", "constraints"]) if (k in r) r[k] = lista(r[k]);
  if (r.options) r.options = r.options.filter((o: { text: string }) => o.text.trim());
  if (r.findings) r.findings = r.findings.filter((f: { description: string }) => f.description.trim());
  for (const k of ["starter_code", "symptom_input"]) if (k in r && !String(r[k] ?? "").trim()) r[k] = null;
  return r;
}

export function ReviewView({ drafts, setDrafts, fallos, alPublicar }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(false); // desmarcada = uso privado
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (id: string, cambio: Partial<Draft>) => setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...cambio } : d)));
  const aPublicar = drafts.filter((d) => !d.discarded);

  const regenerar = async (d: Draft) => {
    setOcupado(d.id); setError("");
    try {
      const r = await api<{ drafts: Record<string, any>[] }>("docente", `${CONTENT_URL}/drafts`, {
        method: "POST",
        body: {
          skill_id: d.skill_id, level: d.level, item_type: d.item_type, item_count: 1, estimated_minutes: d.minutes,
          context: d.context || null, feedback: feedback || null, previous_statement: d.content.statement,
        },
      });
      cambiar(d.id, { content: r.drafts[0], discarded: false });
      setRegenerando(null); setFeedback("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const publicar = async () => {
    setPublicando(true); setError("");
    // Un grupo por (skill, nivel, tipo, tiempo, contexto): así queda registrado cada pedido de generación.
    const grupos = new Map<string, any>();
    for (const d of aPublicar) {
      const clave = `${d.skill_id}|${d.level}|${d.item_type}|${d.minutes}|${d.context}`;
      if (!grupos.has(clave))
        grupos.set(clave, { skill_id: d.skill_id, level: d.level, item_type: d.item_type, estimated_minutes: d.minutes, context: d.context || null, items: [] });
      grupos.get(clave).items.push(limpiar(d.content));
    }
    try {
      await api("docente", `${CONTENT_URL}/items/publish`, { method: "POST", body: { available_to_experts: disponible, groups: [...grupos.values()] } });
      alPublicar(aPublicar.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublicando(false);
    }
  };

  return (
    <section className="formulario ancho">
      <h3>Revisa los borradores</h3>
      <p className="suave">Edita, regenera o descarta cada uno. Nada se guarda en el banco hasta que publiques.</p>
      {fallos.map((f, i) => <p key={i} className="error">No se pudo generar {f.etiqueta}: {f.mensaje}</p>)}

      {drafts.map((d) => (
        <article key={d.id} className={`borrador ${d.discarded ? "descartado" : ""}`}>
          <header>
            <strong>{d.skill_label}</strong>
            <span className="etiqueta">{NOMBRE_TIPO[d.item_type]}</span>
            <span className="suave">nivel {d.level}</span>
            <label className="check">Tiempo (min)
              <input type="number" min="1" className="corto" aria-label="Tiempo estimado" value={d.minutes} disabled={d.discarded}
                     onChange={(e) => cambiar(d.id, { minutes: Number(e.target.value) })} />
            </label>
            {d.discarded && <span className="etiqueta">descartado</span>}
          </header>
          <p>{d.content.statement}</p>
          <div className="acciones">
            {!d.discarded && <button type="button" onClick={() => setEditando(editando === d.id ? null : d.id)}>{editando === d.id ? "Cerrar edición" : "Editar"}</button>}
            {!d.discarded && <button type="button" disabled={ocupado === d.id} onClick={() => { setRegenerando(regenerando === d.id ? null : d.id); setFeedback(""); }}>Regenerar</button>}
            <button type="button" onClick={() => cambiar(d.id, { discarded: !d.discarded })}>{d.discarded ? "Restaurar" : "Descartar"}</button>
          </div>
          {regenerando === d.id && (
            <div className="formulario">
              <label>Comentario para la IA (opcional)
                <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Ej.: hazla más difícil, usa un caso de bases de datos…" />
              </label>
              <button type="button" className="primario" disabled={ocupado === d.id} onClick={() => regenerar(d)}>
                {ocupado === d.id ? "Regenerando…" : "Regenerar este borrador"}
              </button>
            </div>
          )}
          {editando === d.id && !d.discarded && (
            <DraftEditor type={d.item_type} content={d.content} onChange={(c) => cambiar(d.id, { content: c })} />
          )}
        </article>
      ))}

      <footer className="publicar">
        <label className="check">
          <input type="checkbox" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} />
          Dejar las preguntas a disposición de expertos para evaluar (desmarcada = uso privado)
        </label>
        <button type="button" className="primario" disabled={publicando || aPublicar.length === 0} onClick={publicar}>
          {publicando ? "Publicando…" : `Publicar ${aPublicar.length} pregunta${aPublicar.length === 1 ? "" : "s"}`}
        </button>
        {error && <p className="error">{error}</p>}
      </footer>
    </section>
  );
}
