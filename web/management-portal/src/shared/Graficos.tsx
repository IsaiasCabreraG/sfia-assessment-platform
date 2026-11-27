// Gráficos sencillos del resumen de una evaluación: torta (con su leyenda) y barras por nivel de responsabilidad.
import type { ReactNode } from "react";

export interface Porcion { etiqueta: string; valor: number; color: string; icono?: ReactNode }

/** Torta en forma de anillo: cada porción con su color y, al lado, la leyenda con la cantidad y el porcentaje. */
export function Torta({ porciones, titulo }: { porciones: Porcion[]; titulo: string }) {
  const total = porciones.reduce((n, p) => n + p.valor, 0);
  let acumulado = 0;
  return (
    <figure className="grafico torta">
      <figcaption>{titulo}</figcaption>
      <div className="torta-cuerpo">
        <svg viewBox="0 0 42 42" className="torta-anillo" role="img" aria-label={titulo}>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e8eaee" strokeWidth="6" />
          {total > 0 && porciones.filter((p) => p.valor > 0).map((p) => {
            const largo = (p.valor / total) * 100;
            const inicio = acumulado;
            acumulado += largo;
            return <circle key={p.etiqueta} cx="21" cy="21" r="15.9155" fill="none" stroke={p.color} strokeWidth="6"
                           strokeDasharray={`${largo} ${100 - largo}`} strokeDashoffset={25 - inicio} />;
          })}
          <text x="21" y="22.5" textAnchor="middle" className="torta-total">{total}</text>
        </svg>
        <ul className="torta-leyenda">
          {porciones.filter((p) => p.valor > 0).map((p) => (
            <li key={p.etiqueta}>
              <span className="muestra" style={{ background: p.color }} />
              {p.icono}
              <span>{p.etiqueta}</span>
              <span className="suave">{p.valor} · {Math.round((p.valor / total) * 100)} %</span>
            </li>
          ))}
          {total === 0 && <li className="suave">Sin ítems</li>}
        </ul>
      </div>
    </figure>
  );
}

/** Gráfico de líneas clásico: cuántos ítems hay en cada uno de los 7 niveles (los niveles sin ítems quedan en cero). */
export function LineaNiveles({ cantidades, titulo }: { cantidades: Record<number, number>; titulo: string }) {
  const maximo = Math.max(2, ...Object.values(cantidades));
  const marcas = Array.from({ length: maximo + 1 }, (_, i) => i).filter((v) => maximo <= 8 || v % Math.ceil(maximo / 6) === 0);
  const x = (nivel: number) => 14 + ((nivel - 1) / 6) * 110;
  const y = (valor: number) => 54 - (valor / maximo) * 46;
  const puntos = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, c: cantidades[n] ?? 0 }));
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <svg viewBox="0 0 130 68" className="linea-niveles" role="img" aria-label={titulo}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1="14" x2="126" y1={y(v)} y2={y(v)} className="linea-rejilla" />
            <text x="10" y={y(v) + 1.5} textAnchor="end" className="linea-texto">{v}</text>
          </g>
        ))}
        <polyline points={puntos.map((p) => `${x(p.n)},${y(p.c)}`).join(" ")} className="linea-serie" fill="none" />
        {puntos.map((p) => (
          <g key={p.n}>
            <circle cx={x(p.n)} cy={y(p.c)} r="2" className="linea-punto"><title>Nivel {p.n}: {p.c} ítem{p.c === 1 ? "" : "s"}</title></circle>
            <text x={x(p.n)} y="63" textAnchor="middle" className="linea-texto">{p.n}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
