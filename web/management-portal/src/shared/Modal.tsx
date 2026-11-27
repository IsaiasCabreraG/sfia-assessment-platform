"use client";

// Cascarón común de los diálogos: fondo, Esc para cerrar, foco atrapado dentro y devuelto al botón que lo abrió.
import { useEffect, useRef, type ReactNode } from "react";
import { Icono } from "./Estrellas";

const FOCALIZABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ etiqueta, alCerrar, angosto = false, chico = false, encabezado, pie, children }: {
  etiqueta: string; alCerrar: () => void; angosto?: boolean; chico?: boolean;
  /** Parte fija de arriba (título, buscador): no se desplaza con el contenido y deja la X siempre en la esquina. */
  encabezado?: ReactNode;
  /** Parte fija de abajo (botones de acción): siempre visible, aunque el contenido se desplace. */
  pie?: ReactNode; children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); cerrarRef.current(); return; }
      if (e.key !== "Tab" || !caja.current) return;
      const lista = [...caja.current.querySelectorAll<HTMLElement>(FOCALIZABLES)];
      if (lista.length === 0) { e.preventDefault(); return; }
      const primero = lista[0], ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !caja.current.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !caja.current.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
    };
    window.addEventListener("keydown", alTeclear);
    // Si el contenido no pidió el foco (autoFocus), se lo damos a la propia caja.
    if (caja.current && !caja.current.contains(document.activeElement)) caja.current.focus();
    return () => { window.removeEventListener("keydown", alTeclear); previo?.focus?.(); };
  }, []);

  return (
    <div className="menu-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div ref={caja} tabIndex={-1} className={`menu-skills ${angosto ? "angosto" : ""} ${chico ? "chico" : ""}`} role="dialog" aria-modal="true" aria-label={etiqueta}>
        <button type="button" className="cerrar-modal" onClick={alCerrar} aria-label="Cerrar" title="Cerrar"><Icono nombre="cerrar" /></button>
        {encabezado && <div className="modal-encabezado">{encabezado}</div>}
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}
