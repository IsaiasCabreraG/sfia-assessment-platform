"use client";

// Campo numérico con «−» a la izquierda y «+» a la derecha. También se escribe con el teclado (y con ↑ ↓), pero sin las
// flechitas del navegador. `valor` vacío (null) se admite cuando el campo es opcional.
interface Props {
  valor: number | null;
  alCambiar: (valor: number | null) => void;
  min?: number;
  max?: number;
  /** Nombre accesible del campo (el de los botones «−» y «+» es siempre «Menos» y «Más»). */
  etiqueta: string;
  placeholder?: string;
  deshabilitado?: boolean;
  /** Oculto pero ocupando su lugar (para que la fila no cambie de alto). */
  oculto?: boolean;
  autoFocus?: boolean;
}

export function Contador({ valor, alCambiar, min = 1, max, etiqueta, placeholder, deshabilitado = false, oculto = false, autoFocus = false }: Props) {
  const limitar = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  const mover = (paso: number) => alCambiar(limitar((valor ?? (paso > 0 ? min - 1 : min)) + paso));
  return (
    <span className="contador" style={oculto ? { visibility: "hidden" } : undefined}>
      <button type="button" aria-label="Menos" title="Menos" disabled={deshabilitado || (valor !== null && valor <= min)} onClick={() => mover(-1)}>−</button>
      <input type="number" inputMode="numeric" min={min} max={max} aria-label={etiqueta} placeholder={placeholder} disabled={deshabilitado} autoFocus={autoFocus}
             value={valor ?? ""} onChange={(e) => alCambiar(e.target.value === "" ? null : Number(e.target.value))}
             onBlur={() => { if (valor !== null && (valor < min || (max !== undefined && valor > max))) alCambiar(limitar(valor)); }} />
      <button type="button" aria-label="Más" title="Más" disabled={deshabilitado || (max !== undefined && valor !== null && valor >= max)} onClick={() => mover(1)}>+</button>
    </span>
  );
}
