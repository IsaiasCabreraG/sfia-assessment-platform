"use client";

// Barra con dos puntos para elegir el rango de promedio, en estrellas, de 1 a 5 (HU-07).
import type { CSSProperties } from "react";

interface Props {
  min: number;
  max: number;
  alCambiar: (min: number, max: number) => void;
}

export function RangoEstrellas({ min, max, alCambiar }: Props) {
  const fraccion = (n: number) => (n - 1) / 4;
  return (
    <div className="campo-rango">
      <span>Promedio: {min === 1 && max === 5 ? "cualquiera" : `${min} a ${max} estrellas`}</span>
      <div className="rango" style={{ "--a": fraccion(min), "--b": fraccion(max) } as CSSProperties}>
        <div className="pista" />
        <div className="tramo" />
        {/* El punto mínimo sube por encima del máximo cuando ambos están al final, para poder arrastrarlo hacia atrás. */}
        <input type="range" min={1} max={5} step={1} value={min} aria-label="Promedio mínimo"
               style={{ zIndex: min >= 4 ? 3 : 1 }}
               onChange={(e) => alCambiar(Math.min(Number(e.target.value), max), max)} />
        <input type="range" min={1} max={5} step={1} value={max} aria-label="Promedio máximo"
               style={{ zIndex: 2 }}
               onChange={(e) => alCambiar(min, Math.max(Number(e.target.value), min))} />
      </div>
      <div className="rango-marcas">{[1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}</div>
    </div>
  );
}
