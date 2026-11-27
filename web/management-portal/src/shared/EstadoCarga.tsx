// Estado de una lista que no se pudo cargar: el mensaje y un botón para volver a intentarlo.
export function ErrorCarga({ mensaje, alReintentar }: { mensaje: string; alReintentar: () => void }) {
  return (
    <div className="error-carga" role="alert">
      <p className="error">{mensaje}</p>
      <button type="button" onClick={alReintentar}>Reintentar</button>
    </div>
  );
}
