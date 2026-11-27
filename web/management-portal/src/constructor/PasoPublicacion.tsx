"use client";

// Paso 3 del constructor: resumen, requisitos y publicación (HU-12). La duración total se cambia desde el resumen; guardar
// como plantilla, duplicar y descartar están junto a «Publicar». Publicar no se puede deshacer: una publicada no se edita; para cambiarla se duplica.
import { useState } from "react";
import { api } from "../shared/api";
import { BarraFlotante } from "../shared/BarraFlotante";
import { Contador } from "../shared/Contador";
import { BUILDER_URL } from "../shared/config";
import type { EvaluationDetail } from "../shared/types";
import { AccionesEvaluacion } from "./AccionesEvaluacion";
import { Ventana } from "../shared/Ventana";
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
  const [dialogo, setDialogo] = useState(false);
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
    <div className="con-barra-flotante">
      <section className="panel">
        <ResumenSkills detalle={detalle} alCambiarDuracion={() => { setDuracion(detalle.duration_minutes != null ? String(detalle.duration_minutes) : ""); setDialogo(true); }} />
        <h4 className="titulo-seccion">Antes de publicar</h4>
        <p className={`${hayItems ? "ok" : "error"} my-2`}>{hayItems ? "✓ Tiene al menos un ítem" : "✗ Necesita al menos un ítem"}</p>
        <p className={`${noDisponibles.length === 0 ? "ok" : "error"} my-2`}>
          {noDisponibles.length === 0 ? "✓ Todos los ítems están activos y disponibles"
            : `✗ Hay ítems inactivos o que ya no están disponibles: ${[...new Set(noDisponibles.map((i) => i.skill_code))].join(", ")}. Quítalos en el paso 2.`}
        </p>
        <p className="suave m-0">Una evaluación publicada no se puede editar: para cambiarla se duplica en un borrador nuevo.</p>
      </section>
      {error && <p className="error">{error}</p>}
      <BarraFlotante>
        <button className="izquierda" onClick={alVolver}>← Ítems</button>
        <AccionesEvaluacion detalle={detalle} alAbrir={alAbrir} alSalir={alSalir}>
          <button className="primario" disabled={!puede || ocupado} onClick={publicar}>{ocupado ? "Publicando…" : "Publicar"}</button>
        </AccionesEvaluacion>
      </BarraFlotante>

      {dialogo && (
        <Ventana titulo="Duración total" alCerrar={() => setDialogo(false)}>
          <div className="formulario ancho-total">
            <span className="formulario-campo">Duración total (min)
              <Contador etiqueta="Duración total (min)" autoFocus valor={fijada} alCambiar={(n) => setDuracion(n === null ? "" : String(n))}
                        placeholder={detalle.recommended_minutes ? `${detalle.recommended_minutes} (recomendada)` : ""} />
            </span>
            {menor && <p className="aviso m-0">⚠ La duración es menor que la suma de los ítems ({detalle.recommended_minutes} min). Se puede dejar así.</p>}
            {fijada === null && <p className="suave m-0">Si queda vacía, se fijará la recomendada ({detalle.recommended_minutes} min) al publicar.</p>}
            <div className="acciones fin">
              <button onClick={() => setDialogo(false)}>Cancelar</button>
              <button className="primario" onClick={async () => { if (await guardarDuracion()) setDialogo(false); }}>Guardar</button>
            </div>
          </div>
        </Ventana>
      )}
    </div>
  );
}
