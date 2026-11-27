"use client";

// Selector de un rango de niveles SFIA (1 a 7) con cuadritos: los elegidos van con el color de la categoría y los que
// SFIA define para la skill, pero no están elegidos, con su borde. Pulsa un nivel para elegirlo solo y, enseguida,
// otro para extender el rango hasta él (con un rango ya elegido, el primer clic lo reemplaza por ese nivel).
interface Props {
  desde: number;
  hasta: number;
  color: string;
  /** Niveles en los que SFIA define la skill (se marcan con borde). Sin esto, ninguno se marca. */
  sfia?: [number, number];
  alCambiar: (desde: number, hasta: number) => void;
  etiqueta?: string;
}

export function NivelesRango({ desde, hasta, color, sfia, alCambiar, etiqueta = "Niveles" }: Props) {
  const pulsar = (n: number) => {
    if (desde === hasta) alCambiar(Math.min(desde, n), Math.max(desde, n));
    else alCambiar(n, n);
  };
  return (
    <span className="niveles-celdas" role="group" aria-label={etiqueta} title="Pulsa un nivel y luego otro para elegir un rango" style={{ ["--cat" as string]: color }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const elegido = n >= desde && n <= hasta;
        const clase = `nivel-celda${elegido ? " activa" : ""}${!elegido && sfia && n >= sfia[0] && n <= sfia[1] ? " sfia" : ""}`;
        return (
          <button key={n} type="button" className={clase} data-nivel={n} aria-label={`Nivel ${n}`} aria-pressed={elegido}
                  onClick={() => pulsar(n)}>{n}</button>
        );
      })}
    </span>
  );
}
