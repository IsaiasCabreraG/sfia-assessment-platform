// Paginación de listas: se pinta arriba y abajo de la lista.
export function Paginacion({ pagina, total, limite, alCambiar }: { pagina: number; total: number; limite: number; alCambiar: (pagina: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  return (
    <nav className="paginacion" aria-label="Paginación">
      <button type="button" disabled={pagina === 0} onClick={() => alCambiar(pagina - 1)}>‹ Anterior</button>
      <span>Página {pagina + 1} de {paginas}</span>
      <button type="button" disabled={pagina + 1 >= paginas} onClick={() => alCambiar(pagina + 1)}>Siguiente ›</button>
    </nav>
  );
}
