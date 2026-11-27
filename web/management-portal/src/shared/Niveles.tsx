"use client";

// Los 7 niveles de responsabilidad SFIA como celdas coloreadas con el color de la categoría (rampa de la Figura 2).
// Las celdas dentro del rango [min, max] de la skill van coloreadas; con `alElegir` son botones (solo los del rango se pueden elegir).
interface Props { min: number; max: number; color: string; elegido?: number; alElegir?: (nivel: number) => void; titulos?: Record<number, string> }

export function Niveles({ min, max, color, elegido, alElegir, titulos }: Props) {
  return (
    <span className="niveles-celdas" style={{ ["--cat" as string]: color }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const clase = `nivel-celda${n >= min && n <= max ? " activa" : ""}${n === elegido ? " elegida" : ""}`;
        return alElegir
          ? <button key={n} type="button" className={clase} data-nivel={n} aria-label={`Nivel ${n}`} aria-pressed={n === elegido}
                    disabled={n < min || n > max} title={n < min || n > max ? "La skill no está definida en este nivel" : titulos?.[n]}
                    onClick={() => alElegir(n)}>{n}</button>
          : <span key={n} className={clase} data-nivel={n} title={titulos?.[n]}>{n >= min && n <= max ? n : ""}</span>;
      })}
    </span>
  );
}

/** Un solo nivel como celda con el color de la categoría de la skill (para listas compactas, HU-37). */
export function NivelChip({ nivel, color }: { nivel: number; color: string }) {
  return (
    <span className="niveles-celdas" style={{ ["--cat" as string]: color }}>
      <span className="nivel-celda activa" data-nivel={nivel} title={`Nivel ${nivel}`}>{nivel}</span>
    </span>
  );
}
