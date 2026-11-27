// Selector «Ordenar por»: `opciones` es [valor, texto].
export function Ordenar({ valor, opciones, alCambiar }: { valor: string; opciones: [string, string][]; alCambiar: (valor: string) => void }) {
  return (
    <label className="ordenar">Ordenar por
      <select value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {opciones.map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
      </select>
    </label>
  );
}
