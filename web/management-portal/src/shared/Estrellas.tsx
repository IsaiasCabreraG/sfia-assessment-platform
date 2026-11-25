"use client";

// Iconos .svg de /icons y estrellas de puntuación (HU-05, HU-07 y HU-25).
import type { CSSProperties } from "react";

/** Icono de /icons/<nombre>.svg. Toma el color del texto (máscara CSS), así se recolorea desde los estilos. */
export function Icono({ nombre, titulo }: { nombre: string; titulo?: string }) {
  return (
    <span className="icono" role={titulo ? "img" : undefined} aria-label={titulo} title={titulo}
          style={{ "--icono": `url(/icons/${nombre}.svg)` } as CSSProperties} />
  );
}

/** Cinco estrellas con las primeras `valor` llenas (un promedio con decimales se redondea al entero más cercano). */
export function Estrellas({ valor }: { valor: number }) {
  const llenas = Math.round(valor);
  return (
    <span className="estrellas" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= llenas ? "llena" : "vacia"}><Icono nombre="estrella" /></span>
      ))}
    </span>
  );
}

/** Selector de 1 a 5 estrellas enteras (formulario del validador). */
export function SelectorEstrellas({ valor, alElegir }: { valor: number | null; alElegir: (n: number) => void }) {
  return (
    <span className="estrellas selector" role="radiogroup" aria-label="Puntuación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n}
                aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                className={valor !== null && n <= valor ? "llena" : "vacia"} onClick={() => alElegir(n)}>
          <Icono nombre="estrella" />
        </button>
      ))}
    </span>
  );
}
