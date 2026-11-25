"use client";

// Revisión de borradores (HU-04, HU-27 y HU-30): a la izquierda la lista de borradores y a la derecha el elegido,
// completo, con editar, regenerar y descartar arriba como iconos. Los borradores viven solo en pantalla;
// "Publicar" los guarda en el banco (versión 1, activos, sin puntuar).
import { useState } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { Icono } from "../shared/Estrellas";
import { IconoTipo } from "../shared/IconoTipo";
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import { NivelChip } from "../shared/Niveles";
import type { Draft } from "../shared/types";
import { VistaItem } from "../shared/VistaItem";
import { DraftEditor } from "./DraftEditor";

interface Props {
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  fallos: { etiqueta: string; mensaje: string }[];
  alPublicar: (cantidad: number) => void;
  /** Volver al resumen: descarta los borradores generados y conserva lo que se eligió (HU-30-2). */
  alVolver: () => void;
}

const COLOR_NEUTRO = "#5b6168";

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

export function ReviewView({ drafts, setDrafts, fallos, alPublicar, alVolver }: Props) {
  const [seleccion, setSeleccion] = useState<string | null>(drafts[0]?.id ?? null);
  const [editando, setEditando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [disponible, setDisponible] = useState(false); // desmarcada = uso privado
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (id: string, cambio: Partial<Draft>) => setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...cambio } : d)));
  const aPublicar = drafts.filter((d) => !d.discarded);
  const indice = Math.max(0, drafts.findIndex((d) => d.id === seleccion));
  const actual: Draft | undefined = drafts[indice];

  const elegir = (id: string) => { setSeleccion(id); setEditando(false); setRegenerando(false); setFeedback(""); };

  const volver = () => {
    if (window.confirm("Se descartarán los borradores generados. Se conserva lo que elegiste (skills, nivel y tipos) para generar otra tanda. ¿Continuar?")) alVolver();
  };

  const regenerar = async (d: Draft) => {
    setOcupado(true); setError("");
    try {
      const r = await api<{ drafts: Record<string, any>[] }>("docente", `${CONTENT_URL}/drafts`, {
        method: "POST",
        body: {
          skill_id: d.skill_id, level: d.level, item_type: d.item_type, item_count: 1, estimated_minutes: d.minutes,
          context: d.context || null, feedback: feedback || null, previous_statement: d.content.statement,
          correct_position: d.item_type === "single_choice"
            ? d.content.options.findIndex((o: { is_correct: boolean }) => o.is_correct) + 1 || null : null,
          correct_answer: d.item_type === "true_false" ? d.content.correct_answer : null,
        },
      });
      cambiar(d.id, { content: r.drafts[0], discarded: false });
      setRegenerando(false); setFeedback("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
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
    <section className="revision">
      <header className="revision-cabecera">
        <button type="button" className="icono-btn" aria-label="Volver" title="Volver al resumen (se descartan los borradores)" onClick={volver}>
          <Icono nombre="volver" /> Volver
        </button>
        <h3>Revisa los borradores</h3>
      </header>
      <p className="suave">Elige un borrador para verlo completo; edítalo, regéneralo o descártalo. Nada se guarda en el banco hasta que publiques.</p>
      {fallos.map((f, i) => <p key={i} className="error">No se pudo generar {f.etiqueta}: {f.mensaje}</p>)}

      <div className="dos-columnas">
        <section className="lista">
          <p className="suave">{aPublicar.length} de {drafts.length} para publicar</p>
          {drafts.map((d) => (
            <button key={d.id} type="button" onClick={() => elegir(d.id)}
                    className={`fila borrador-fila ${d.id === actual?.id ? "activa" : ""} ${d.discarded ? "descartado" : ""}`}>
              <span className="fila-titulo">
                <span className="fila-datos">
                  <IconoTipo tipo={d.item_type} />{" "}
                  <strong>{d.skill_label.split(" · ")[0]}</strong>{" "}
                  <NivelChip nivel={d.level} color={d.skill_color ?? COLOR_NEUTRO} />{" "}
                  <span className="suave">{d.minutes} min</span>
                </span>
                {d.discarded && <span className="etiqueta">descartado</span>}
              </span>
              <span className="enunciado">{d.content.statement}</span>
            </button>
          ))}
        </section>

        <section className="panel panel-borrador">
          {actual ? (
            <>
              <header className="panel-cabecera">
                <strong className="indicador">Borrador {indice + 1} de {drafts.length}</strong>
                <span className="barra-iconos">
                  <button type="button" className="icono-btn" aria-label="Borrador anterior" title="Borrador anterior" disabled={indice === 0}
                          onClick={() => elegir(drafts[indice - 1].id)}>‹</button>
                  <button type="button" className="icono-btn" aria-label="Borrador siguiente" title="Borrador siguiente" disabled={indice === drafts.length - 1}
                          onClick={() => elegir(drafts[indice + 1].id)}>›</button>
                  {!actual.discarded && (
                    <button type="button" className="icono-btn" aria-label={editando ? "Cerrar edición" : "Editar"} title={editando ? "Cerrar edición" : "Editar"}
                            aria-pressed={editando} onClick={() => { setEditando(!editando); setRegenerando(false); }}>
                      <Icono nombre="editar" />
                    </button>
                  )}
                  {!actual.discarded && (
                    <button type="button" className="icono-btn" aria-label="Regenerar" title="Regenerar" disabled={ocupado} aria-pressed={regenerando}
                            onClick={() => { setRegenerando(!regenerando); setEditando(false); setFeedback(""); }}>
                      <Icono nombre="regenerar" />
                    </button>
                  )}
                  <button type="button" className="icono-btn" aria-label={actual.discarded ? "Restaurar" : "Descartar"} title={actual.discarded ? "Restaurar" : "Descartar"}
                          onClick={() => { cambiar(actual.id, { discarded: !actual.discarded }); setEditando(false); setRegenerando(false); }}>
                    <Icono nombre={actual.discarded ? "restaurar" : "descartar"} />
                  </button>
                </span>
              </header>

              <div className="panel-meta">
                <IconoTipo tipo={actual.item_type} />
                <span>{NOMBRE_TIPO[actual.item_type]}</span>
                <strong>{actual.skill_label}</strong>
                <NivelChip nivel={actual.level} color={actual.skill_color ?? COLOR_NEUTRO} />
                <label className="check">Tiempo (min)
                  <input type="number" min="1" className="corto" aria-label="Tiempo estimado" value={actual.minutes} disabled={actual.discarded}
                         onChange={(e) => cambiar(actual.id, { minutes: Number(e.target.value) })} />
                </label>
                {actual.discarded && <span className="etiqueta">descartado</span>}
              </div>

              {editando && !actual.discarded
                ? <DraftEditor type={actual.item_type} content={actual.content} onChange={(c) => cambiar(actual.id, { content: c })} />
                : <VistaItem type={actual.item_type} c={actual.content} />}

              {regenerando && !actual.discarded && (
                <div className="regenerar-caja">
                  <label>Comentario para la IA (opcional)
                    <textarea rows={2} autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)}
                              placeholder="Ej.: hazla más difícil, usa un caso de bases de datos…" />
                  </label>
                  <button type="button" className="primario" disabled={ocupado} onClick={() => regenerar(actual)}>
                    {ocupado ? "Regenerando…" : "Regenerar este borrador"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="suave">No hay borradores.</p>
          )}
        </section>
      </div>

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
