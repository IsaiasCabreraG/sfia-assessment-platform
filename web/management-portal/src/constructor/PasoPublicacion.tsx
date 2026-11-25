"use client";

// Paso 3 del constructor: resumen, requisitos y publicación (HU-12). Aquí también se fija la duración total, se guarda
// como plantilla, se duplica o se descarta. Publicar no se puede deshacer: una publicada no se edita; para cambiarla se duplica.
import { useState } from "react";
import { api } from "../shared/api";
import { BUILDER_URL } from "../shared/config";
import type { EvaluationDetail } from "../shared/types";
import { AccionesEvaluacion } from "./AccionesEvaluacion";
import { ResumenSkills } from "./ResumenSkills";

interface Props {
  detalle: EvaluationDetail;
  alCambio: (d: EvaluationDetail) => void;
  alVolver: () => void;
  alAbrir: (id: string) => void;
  alSalir: () => void;
}

export function PasoPublicacion({ detalle, alCambio, alVolver, alAbrir, alSalir }: Props) {
  const [duracion, setDuracion] = useState(detalle.duration_minutes != null ? String(detalle.duration_minutes) : "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const noDisponibles = detalle.items.filter((i) => !i.item_active || !(i.item_public || i.is_mine));
  const hayItems = detalle.items.length > 0;
  const puede = hayItems && noDisponibles.length === 0;
  const fijada = duracion.trim() ? Number(duracion) : null;
  const menor = fijada !== null && detalle.recommended_minutes > 0 && fijada < detalle.recommended_minutes;

  /** Guarda la duración fijada si cambió. Devuelve false si falló. */
  const guardarDuracion = async (): Promise<boolean> => {
    if (fijada === detalle.duration_minutes) return true;
    try {
      alCambio(await api<EvaluationDetail>("docente", `${BUILDER_URL}/evaluations/${detalle.id}`, { method: "PUT", body: { duration_minutes: fijada } }));
      return true;
    } catch (e) { setError((e as Error).message); return false; }
  };

  const publicar = async () => {
    setOcupado(true); setError("");
    try {
      if (!(await guardarDuracion())) return;
      alCambio(await api<EvaluationDetail>("docente", `${BUILDER_URL}/evaluations/${detalle.id}/publish`, { method: "POST", body: {} }));
    } catch (e) { setError((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <div>
      <div className="dos-columnas" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="panel">
          <h3 style={{ margin: "0 0 .5rem" }}>Resumen</h3>
          <ResumenSkills detalle={detalle} />
          <label className="formulario" style={{ marginTop: ".8rem" }}>Duración total (min)
            <input type="number" min="1" value={duracion} onChange={(e) => setDuracion(e.target.value)} onBlur={guardarDuracion}
                   placeholder={detalle.recommended_minutes ? `${detalle.recommended_minutes} (recomendada)` : ""} />
          </label>
          {menor && <p className="aviso" style={{ marginTop: ".5rem" }}>⚠ La duración es menor que la suma de los ítems ({detalle.recommended_minutes} min). Se puede dejar así.</p>}
          {fijada === null && <p className="suave">Si queda vacía, se fijará la recomendada ({detalle.recommended_minutes} min) al publicar.</p>}
        </section>
        <section className="panel">
          <h3 style={{ margin: "0 0 .5rem" }}>Antes de publicar</h3>
          <p className={hayItems ? "ok" : "error"} style={{ margin: ".2rem 0" }}>{hayItems ? "✓ Tiene al menos un ítem" : "✗ Necesita al menos un ítem"}</p>
          <p className={noDisponibles.length === 0 ? "ok" : "error"} style={{ margin: ".2rem 0" }}>
            {noDisponibles.length === 0 ? "✓ Todos los ítems están activos y disponibles"
              : `✗ Hay ítems inactivos o que ya no están disponibles: ${[...new Set(noDisponibles.map((i) => i.skill_code))].join(", ")}. Quítalos en el paso 2.`}
          </p>
          <p className="suave">Una evaluación publicada no se puede editar: para cambiarla se duplica en un borrador nuevo.</p>
        </section>
      </div>
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: ".8rem" }}>
        <AccionesEvaluacion detalle={detalle} alAbrir={alAbrir} alSalir={alSalir}>
          <button className="primario" disabled={!puede || ocupado} onClick={publicar}>{ocupado ? "Publicando…" : "Publicar"}</button>
        </AccionesEvaluacion>
      </div>
      <div className="acciones" style={{ marginTop: ".8rem" }}><button onClick={alVolver}>← Ítems</button></div>
    </div>
  );
}
