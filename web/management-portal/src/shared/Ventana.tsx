"use client";

// Ventana modal sencilla (se cierra con Esc o al pulsar fuera) para elegir de una lista, ver una ficha o confirmar.
import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function Ventana({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  return (
    <Modal etiqueta={titulo} alCerrar={alCerrar} angosto encabezado={<div className="menu-cabecera"><strong>{titulo}</strong></div>}>
      {children}
    </Modal>
  );
}
