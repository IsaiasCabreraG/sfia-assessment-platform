"use client";

// Una evaluación publicada o descartada: solo se puede ver. Desde aquí se duplica (para cambiarla), se guarda como
// plantilla o se descarta. El link y las ejecuciones llegan con el apartado Ejecuciones.
import { useState } from "react";
import type { EvaluationDetail } from "../shared/types";
import { AccionesEvaluacion } from "./AccionesEvaluacion";
import { FilaItem } from "../shared/FilaItem";
import { FichaItem } from "./FichaItem";
import { ResumenSkills } from "./ResumenSkills";

interface Props { detalle: EvaluationDetail; alAbrir: (id: string) => void; alSalir: () => void }

export function EvaluacionSoloLectura({ detalle, alAbrir, alSalir }: Props) {
  const [ficha, setFicha] = useState<{ itemId: string; version: number } | null>(null);
  const publicada = detalle.status === "published";
  const categoriaDe = (skillId: string) => detalle.skills.find((s) => s.id === skillId)?.category ?? null;
  return (
    <div>
      <div className="dos-columnas cols-igual">
        <section className="panel">
          <h3 className="mb-5">Evaluación <span className="etiqueta">{publicada ? "publicada" : "descartada"}</span></h3>
          {publicada && detalle.published_at && <p className="mb-4">Publicada el {new Date(detalle.published_at).toLocaleDateString("es-CL")} · {detalle.duration_minutes ?? detalle.recommended_minutes} min</p>}
          <p className="suave">Esta evaluación ya no se puede modificar. Para cambiarla, duplícala.</p>
          <ResumenSkills detalle={detalle} />
          <div className="mt-8"><AccionesEvaluacion detalle={detalle} alAbrir={alAbrir} alSalir={alSalir} puedeDescartar={publicada} /></div>
        </section>
        <section className="panel">
          <h3 className="mb-5">Ítems</h3>
          {detalle.items.map((it) => (
            <FilaItem key={it.item_version_id} alPulsar={() => setFicha({ itemId: it.item_id, version: it.version })}
                      inicio={<b>{it.position}</b>}
                      d={{ type: it.type, skill_code: it.skill_code, category: categoriaDe(it.skill_id), level: it.level, estimated_minutes: it.estimated_minutes, statement: it.statement }} />
          ))}
          <div className="aviso mt-8">
            <strong>Ejecuciones</strong> <span className="etiqueta">próximamente</span>
            <div className="suave">Crear una ejecución con fechas e invitados, modificarla o terminarla se hará en el apartado Ejecuciones.</div>
          </div>
        </section>
      </div>
      {ficha && <FichaItem itemId={ficha.itemId} version={ficha.version} alCerrar={() => setFicha(null)} />}
    </div>
  );
}
