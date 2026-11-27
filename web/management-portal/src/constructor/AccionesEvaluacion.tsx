"use client";

// Acciones sobre una evaluación guardada: duplicar (la forma de «cambiar» una publicada), guardarla como plantilla
// y descartarla. Las usan el paso 3 y la vista de una evaluación publicada.
import { useConfirmar } from "../shared/useConfirmar";
import { useState, type ReactNode } from "react";
import { api } from "../shared/api";
import { BUILDER_URL } from "../shared/config";
import type { EvaluationDetail } from "../shared/types";
import { DialogoPlantilla } from "./DialogoPlantilla";

interface Props {
  detalle: EvaluationDetail;
  alAbrir: (id: string) => void;   // abre otra evaluación (el duplicado)
  alSalir: () => void;             // vuelve al listado (tras descartar)
  puedeDescartar?: boolean;        // una evaluación descartada ya no se descarta de nuevo
  children?: ReactNode;            // botones propios del paso (por ejemplo, Publicar)
}

export function AccionesEvaluacion({ detalle, alAbrir, alSalir, puedeDescartar = true, children }: Props) {
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [plantilla, setPlantilla] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  const duplicar = async () => {
    try {
      const nueva = await api<{ id: string }>("docente", `${BUILDER_URL}/evaluations/${detalle.id}/duplicate`, { method: "POST", body: {} });
      alAbrir(nueva.id);
    } catch (e) { setError((e as Error).message); }
  };

  const descartar = async () => {
    if (!await confirmar(`¿Descartar «${detalle.name}»? Dejará de aparecer entre las disponibles.`)) return;
    try {
      await api("docente", `${BUILDER_URL}/evaluations/${detalle.id}/discard`, { method: "POST", body: {} });
      alSalir();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      {dialogoConfirmar}
      <div className="acciones">
        {children}
        <button onClick={() => { setAviso(""); setPlantilla(true); }}>Guardar como plantilla…</button>
        <button onClick={duplicar}>Duplicar</button>
        {puedeDescartar && <button className="peligro" onClick={descartar}>Descartar</button>}
      </div>
      {aviso && <p className="ok">{aviso}</p>}
      {error && <p className="error">{error}</p>}
      {plantilla && (
        <DialogoPlantilla titulo="Guardar como plantilla" nombreInicial={detalle.name} items={detalle.items} textoGuardar="Guardar plantilla"
          alCerrar={() => setPlantilla(false)}
          alGuardar={async (nombre, visibilidad, hacerPublicos) => {
            await api("docente", `${BUILDER_URL}/evaluations/${detalle.id}/template`, {
              method: "POST", body: { name: nombre, visibility: visibilidad, make_items_public: hacerPublicos } });
            setAviso(`Plantilla «${nombre}» guardada (${visibilidad === "public" ? "pública" : "privada"}).`);
          }} />
      )}
    </>
  );
}
