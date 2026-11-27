"use client";

// Acciones del docente sobre un ítem del banco: activar/desactivar (HU-09), editar (HU-13), regenerar con un nuevo
// contexto (HU-14) y ver el historial de versiones (HU-26). Editar y regenerar guardan una versión nueva del ítem
// o, si el ítem es de otro docente, una copia propia (HU-15).
import { Contador } from "../shared/Contador";
import { useConfirmar } from "../shared/useConfirmar";
import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../shared/api";
import { Icono } from "../shared/Estrellas";
import { BUILDER_URL, CONTENT_URL } from "../shared/config";
import type { ItemDetailData, ItemVersionInfo } from "../shared/types";
import { VistaItem } from "../shared/VistaItem";
import { DraftEditor } from "./DraftEditor";
import { limpiar } from "./ReviewView";

type Modo = null | "editar" | "regenerar" | "historial";
type Contenido = Record<string, any>;
const ORIGEN: Record<string, string> = { generated: "generada", regenerated: "regenerada", edited: "editada" };

/** Contenido del ítem en el formato que edita DraftEditor (el mismo de un borrador). */
function contenidoEditable(item: ItemDetailData): Contenido {
  const c: Contenido = { statement: item.statement, evaluation_goal: item.evaluation_goal, ...item.content };
  if (item.rubric) c.rubric = item.rubric;
  if (c.options) c.options = c.options.map((o: { text: string; is_correct: boolean }) => ({ text: o.text, is_correct: o.is_correct }));
  return c;
}

interface Props {
  item: ItemDetailData;
  recargar: () => void;
  /** Abre otro ítem del banco (por ejemplo, la copia recién creada). */
  abrir: (id: string) => void;
  /** Dónde dibujar los botones con icono (arriba a la derecha del detalle). */
  barra: HTMLElement | null;
}

export function AccionesItem({ item, recargar, abrir, barra }: Props) {
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [modo, setModo] = useState<Modo>(null);
  const [contenido, setContenido] = useState<Contenido>({});
  const [minutos, setMinutos] = useState(item.estimated_minutes);
  const [disponible, setDisponible] = useState(false); // desmarcada = uso privado
  const [contexto, setContexto] = useState("");
  const [vista, setVista] = useState<{ draft: Contenido; context: string } | null>(null);
  const [versiones, setVersiones] = useState<ItemVersionInfo[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cerrar = () => { setModo(null); setVista(null); };

  const abrirModo = (m: Exclude<Modo, null>) => {
    if (modo === m) return cerrar();
    setError(""); setAviso(""); setModo(m); setVista(null); setContexto("");
    setContenido(contenidoEditable(item)); setMinutos(item.estimated_minutes);
    setDisponible(item.is_mine ? item.available_to_experts : false);
    if (m === "historial")
      api<{ versions: ItemVersionInfo[] }>("docente", `${CONTENT_URL}/items/${item.id}/versions`)
        .then((r) => setVersiones(r.versions)).catch((e) => setError(e.message));
  };

  /** Antes de desactivar un ítem o volverlo privado, avisa dónde se usa (las evaluaciones publicadas no se ven afectadas;
   *  las plantillas públicas dejan de estar disponibles). Devuelve false si el docente se arrepiente. */
  const confirmarUso = async (accion: string): Promise<boolean> => {
    try {
      const u = await api<{ published_evaluations: number; public_templates: number }>("docente", `${BUILDER_URL}/items/${item.id}/usage`);
      if (u.published_evaluations === 0 && u.public_templates === 0) return true;
      const partes: string[] = [];
      if (u.published_evaluations) partes.push(`${u.published_evaluations} evaluación${u.published_evaluations === 1 ? " publicada" : "es publicadas"} (no se ${u.published_evaluations === 1 ? "verá afectada" : "verán afectadas"})`);
      if (u.public_templates) partes.push(`${u.public_templates} plantilla${u.public_templates === 1 ? " pública" : "s públicas"} (dejará${u.public_templates === 1 ? "" : "n"} de estar disponible${u.public_templates === 1 ? "" : "s"})`);
      return await confirmar(`Este ítem está en ${partes.join(" y en ")}. ¿${accion}?`);
    } catch (e) {
      setError(`No se pudo comprobar dónde se usa el ítem: ${(e as Error).message}`);
      return false;
    }
  };

  const cambiarEstado = async () => {
    if (item.status === "active" && !(await confirmarUso("Desactivarlo"))) return;
    await api("docente", `${CONTENT_URL}/items/${item.id}/status`, {
      method: "PATCH", body: { status: item.status === "active" ? "inactive" : "active" },
    });
    recargar();
  };

  const guardar = async (origen: "edited" | "regenerated") => {
    setOcupado(true); setError("");
    try {
      if (item.is_mine && item.available_to_experts && !disponible && !(await confirmarUso("Volverlo privado"))) return;
      const r = await api<{ id: string; version: number; copy: boolean }>("docente", `${CONTENT_URL}/items/${item.id}`, {
        method: "PUT",
        body: {
          item: origen === "edited" ? limpiar(contenido) : vista!.draft, estimated_minutes: minutos,
          available_to_experts: disponible, origin: origen, context: origen === "regenerated" ? vista!.context : null,
        },
      });
      cerrar(); recargar();
      if (r.copy) abrir(r.id); else setAviso(`Se guardó la versión ${r.version}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const generarVista = async () => {
    setOcupado(true); setError("");
    try {
      const r = await api<{ draft: Contenido; context: string; estimated_minutes: number }>(
        "docente", `${CONTENT_URL}/items/${item.id}/regenerate`, { method: "POST", body: { context: contexto } });
      setVista({ draft: r.draft, context: r.context }); setMinutos(r.estimated_minutes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const pie = (origen: "edited" | "regenerated") => (
    <>
      {!item.is_mine && <p className="aviso">Este ítem es de otro docente: se guardará como una copia tuya y el original no cambia.</p>}
      <label className="check">
        <input type="checkbox" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} />
        Disponible para expertos (desmarcada = uso privado){item.is_mine && " — afecta a todas las versiones del ítem"}
      </label>
      <div className="acciones-item">
        <button type="button" className="primario" disabled={ocupado} onClick={() => guardar(origen)}>
          {ocupado ? "Guardando…" : item.is_mine ? "Guardar como versión nueva" : "Guardar como copia mía"}
        </button>
        <button type="button" onClick={cerrar}>Descartar</button>
      </div>
    </>
  );

  return (
    <>
      {dialogoConfirmar}
      {barra && createPortal(
        <>
          <button type="button" className="icono-btn" aria-label="Editar" title="Editar" aria-pressed={modo === "editar"} onClick={() => abrirModo("editar")}>
            <Icono nombre="editar" />
          </button>
          <button type="button" className="icono-btn" aria-label="Regenerar con otro contexto" title="Regenerar con otro contexto" aria-pressed={modo === "regenerar"}
                  onClick={() => abrirModo("regenerar")}>
            <Icono nombre="regenerar" />
          </button>
          <button type="button" className="icono-btn" aria-label="Historial" title="Historial" aria-pressed={modo === "historial"} onClick={() => abrirModo("historial")}>
            <Icono nombre="historial" />
          </button>
          {item.is_mine && (
            <button type="button" className={`icono-btn ${item.status === "active" ? "peligro" : ""}`} onClick={cambiarEstado}
                    aria-label={item.status === "active" ? "Desactivar ítem" : "Activar ítem"} title={item.status === "active" ? "Desactivar ítem" : "Activar ítem"}>
              <Icono nombre={item.status === "active" ? "desactivar" : "activar"} />
            </button>
          )}
        </>, barra)}
      {aviso && <p className="ok">{aviso}</p>}
      {error && <p className="error">{error}</p>}

      {modo === "editar" && (
        <div className="acciones-caja">
          <DraftEditor type={item.type} content={contenido} onChange={setContenido} />
          <span className="check">Tiempo (min)
            <Contador etiqueta="Tiempo estimado" valor={minutos} alCambiar={(n) => setMinutos(n ?? 1)} />
          </span>
          {pie("edited")}
        </div>
      )}

      {modo === "regenerar" && (
        <div className="acciones-caja">
          <label>Nuevo contexto (empresa, cargo, lenguaje…)
            <textarea rows={2} value={contexto} onChange={(e) => setContexto(e.target.value)}
                      placeholder="Ej.: un banco chileno, backend en Java" />
          </label>
          <div className="acciones-item">
            <button type="button" className="primario" disabled={ocupado || !contexto.trim()} onClick={generarVista}>
              {ocupado && !vista ? "Generando…" : vista ? "Generar otra vista previa" : "Generar vista previa"}
            </button>
          </div>
          {vista && (
            <>
              <VistaItem type={item.type} c={vista.draft} />
              {pie("regenerated")}
            </>
          )}
        </div>
      )}

      {modo === "historial" && (
        <div className="acciones-caja">
          <table className="historial">
            <thead><tr><th>Versión</th><th>Origen</th><th>Fecha</th><th>Puntuación</th></tr></thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.id}>
                  <td>{v.version}</td><td>{ORIGEN[v.origin] ?? v.origin}</td>
                  <td>{new Date(v.created_at).toLocaleString("es-CL")}</td>
                  <td>{v.count === 0 || v.average === null ? "sin puntuar" : `${Number(v.average).toFixed(1)} (${v.count})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
