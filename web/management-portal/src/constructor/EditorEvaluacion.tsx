"use client";

// Asistente de tres pasos para armar una evaluación: 1 Reglas · 2 Ítems · 3 Publicación. Una evaluación publicada o
// descartada no se edita: se abre en solo lectura.
import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { BUILDER_URL } from "../shared/config";
import type { EvaluationDetail } from "../shared/types";
import { EvaluacionSoloLectura } from "./EvaluacionSoloLectura";
import { PasoItems } from "./PasoItems";
import { PasoPublicacion } from "./PasoPublicacion";
import { PasoReglas } from "./PasoReglas";

interface Props {
  id: string | null; // null = evaluación nueva
  alSalir: () => void;
  /** Abre otra evaluación en el asistente (por ejemplo, la creada a partir de una plantilla o un duplicado). */
  alAbrir: (id: string) => void;
}

export function EditorEvaluacion({ id, alSalir, alAbrir }: Props) {
  const [detalle, setDetalle] = useState<EvaluationDetail | null>(null);
  const [listo, setListo] = useState(id === null);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id === null) return;
    api<EvaluationDetail>("docente", `${BUILDER_URL}/evaluations/${id}`)
      .then((d) => { setDetalle(d); setListo(true); })
      .catch((e) => setError(e.message));
  }, [id]);

  const soloLectura = detalle !== null && detalle.status !== "draft";
  const botonPaso = (n: 1 | 2 | 3, texto: string, habilitado: boolean, titulo?: string) => (
    <button type="button" className={`paso-item ${paso === n ? "activo" : ""}`} aria-pressed={paso === n} disabled={!habilitado}
            title={habilitado ? undefined : titulo} onClick={() => setPaso(n)}><b>{n}</b> {texto}</button>
  );

  return (
    <section>
      <div className="acciones" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{detalle ? detalle.name : "Nueva evaluación"}</h2>
        <button onClick={alSalir}>← Mis evaluaciones</button>
      </div>
      {!soloLectura && (
        <div className="pasos-barra" aria-label="Pasos">
          {botonPaso(1, "Reglas", true)}
          {botonPaso(2, "Ítems", detalle !== null, "Guarda las reglas primero")}
          {botonPaso(3, "Publicación", detalle !== null, "Guarda las reglas primero")}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {listo && soloLectura && detalle && <EvaluacionSoloLectura detalle={detalle} alAbrir={alAbrir} alSalir={alSalir} />}
      {listo && !soloLectura && paso === 1 && <PasoReglas detalle={detalle} alAbrir={alAbrir} alGuardar={setDetalle} alSiguiente={() => setPaso(2)} />}
      {listo && !soloLectura && paso === 2 && detalle && <PasoItems detalle={detalle} alCambio={setDetalle} alVolver={() => setPaso(1)} alSiguiente={() => setPaso(3)} />}
      {listo && !soloLectura && paso === 3 && detalle && <PasoPublicacion detalle={detalle} alCambio={setDetalle} alVolver={() => setPaso(2)} alAbrir={alAbrir} alSalir={alSalir} />}
    </section>
  );
}
