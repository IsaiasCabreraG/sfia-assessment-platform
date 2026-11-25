"use client";

// Ventana modal sencilla (se cierra con Esc o al pulsar fuera) para elegir de una lista, ver una ficha o confirmar.
import { useEffect, type ReactNode } from "react";

export function Ventana({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);
  return (
    <div className="menu-fondo" onClick={alCerrar}>
      <div className="menu-skills angosto" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="menu-cabecera"><strong>{titulo}</strong><button type="button" onClick={alCerrar} aria-label="Cerrar">×</button></div>
        {children}
      </div>
    </div>
  );
}
