"use client";

// Confirmación en un diálogo propio (en lugar de window.confirm): `if (!(await confirmar("¿Seguro?"))) return;`
// El hook devuelve la función y el diálogo, que el componente debe pintar en algún lugar de su JSX.
import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

interface Pendiente { mensaje: string; resolver: (aceptado: boolean) => void }

export function useConfirmar(): readonly [(mensaje: string) => Promise<boolean>, ReactNode] {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const confirmar = useCallback((mensaje: string) => new Promise<boolean>((resolver) => setPendiente({ mensaje, resolver })), []);
  const responder = (aceptado: boolean) => { pendiente?.resolver(aceptado); setPendiente(null); };
  const dialogo = pendiente && (
    <Modal etiqueta="Confirmar" alCerrar={() => responder(false)} chico>
      <p>{pendiente.mensaje}</p>
      <div className="acciones fin">
        <button type="button" onClick={() => responder(false)}>Cancelar</button>
        <button type="button" className="primario" autoFocus onClick={() => responder(true)}>Aceptar</button>
      </div>
    </Modal>
  );
  return [confirmar, dialogo] as const;
}
