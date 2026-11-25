"use client";

// Una evaluación publicada o descartada: solo se puede ver. Desde aquí se duplica (para cambiarla), se guarda como
// plantilla o se descarta. El link y las ejecuciones llegan con el apartado Ejecuciones.
import { useState } from "react";
import type { EvaluationDetail } from "../shared/types";
import { AccionesEvaluacion } from "./AccionesEvaluacion";
import { FichaItem } from "./FichaItem";
import { ResumenSkills } from "./ResumenSkills";

interface Props { detalle: EvaluationDetail; alAbrir: (id: string) => void; alSalir: () => void }

export function EvaluacionSoloLectura({ detalle, alAbrir, alSalir }: Props) {
  const [ficha, setFicha] = useState<{ itemId: string; version: number } | null>(null);
  const publicada = detalle.status === "published";
  return (
    <div>
      <div className="dos-columnas" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="panel">
          <h3 style={{ margin: "0 0 .5rem" }}>Evaluación <span className="etiqueta">{publicada ? "publicada" : "descartada"}</span></h3>
          {publicada && detalle.published_at && <p style={{ margin: "0 0 .4rem" }}>Publicada el {new Date(detalle.published_at).toLocaleDateString("es-CL")} · {detalle.duration_minutes ?? detalle.recommended_minutes} min</p>}
          <p className="suave">Esta evaluación ya no se puede modificar. Para cambiarla, duplícala.</p>
          <ResumenSkills detalle={detalle} />
          <div style={{ marginTop: ".8rem" }}><AccionesEvaluacion detalle={detalle} alAbrir={alAbrir} alSalir={alSalir} puedeDescartar={publicada} /></div>
        </section>
        <section className="panel">
          <h3 style={{ margin: "0 0 .5rem" }}>Ítems</h3>
          {detalle.items.map((it) => (
            <div key={it.item_version_id} className="fila-eval">
              <b>{it.position}</b>
              <div className="fila-eval-datos">
                <span><strong>{it.skill_code}</strong> <span className="etiqueta">nivel {it.level}</span><span className="etiqueta">{it.estimated_minutes} min</span></span>
                <span className="enunciado">{it.statement}</span>
              </div>
              <button type="button" onClick={() => setFicha({ itemId: it.item_id, version: it.version })}>Rúbrica</button>
            </div>
          ))}
          <div className="aviso" style={{ marginTop: ".8rem" }}>
            <strong>Ejecuciones</strong> <span className="etiqueta">próximamente</span>
            <div className="suave">Crear una ejecución con fechas e invitados, modificarla o terminarla se hará en el apartado Ejecuciones.</div>
          </div>
        </section>
      </div>
      {ficha && <FichaItem itemId={ficha.itemId} version={ficha.version} alCerrar={() => setFicha(null)} />}
    </div>
  );
}
