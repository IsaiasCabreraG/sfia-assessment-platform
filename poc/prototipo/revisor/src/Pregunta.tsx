import { useEffect, useState } from "react";
import { obtenerItem, revisarItem } from "./api";
import type { ItemDetalle } from "./tipos";

export default function Pregunta({ id }: { id: string }) {
  const [item, setItem] = useState<ItemDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setItem(null);
    obtenerItem(id).then(setItem).catch((e) => setError(e.message));
  }, [id]);

  async function decidir(decision: "aprobada" | "rechazada") {
    if (decision === "rechazada" && !motivo.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      setItem(await revisarItem(id, decision, motivo));
      setRechazando(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const volver = <a className="volver" href="#/">← Volver a la lista</a>;

  if (!item) {
    return <>{volver}{error ? <p className="error" role="alert">{error}</p> : <p>Cargando…</p>}</>;
  }

  return (
    <>
      {volver}
      <h1>Pregunta {item.skill_info.codigo}</h1>
      <p><span className={`estado ${item.revision}`}>{item.revision}</span></p>

      <section className="tarjeta">
        <dl className="datos">
          <div><dt>Dificultad</dt><dd>{item.dificultad}</dd></div>
          <div><dt>Tiempo estimado</dt><dd>{item.tiempo_min} min</dd></div>
          <div><dt>Tipo</dt><dd>{item.tipo}</dd></div>
        </dl>

        <details>
          <summary><b>{item.skill_info.codigo}</b> · {item.skill_info.nombre}</summary>
          <p>{item.skill_info.descripcion}</p>
        </details>
        <details>
          <summary>Nivel de responsabilidad <b>{item.nivel_info.nivel}</b> · {item.nivel_info.nombre}</summary>
          <p>{item.nivel_info.descripcion}</p>
        </details>
      </section>

      <section className="tarjeta">
        <h2>Enunciado</h2>
        <p className="enunciado">{item.enunciado}</p>
        <h2>Rúbrica</h2>
        <ul>{item.rubrica.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <h2>Criterios de aceptación</h2>
        <ul>{item.criterios_aceptacion.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </section>

      {item.revision === "rechazada" && item.motivo_rechazo && (
        <p className="motivo"><b>Motivo del rechazo:</b> {item.motivo_rechazo}</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      {item.revision === "pendiente" && (
        <section className="tarjeta">
          {rechazando ? (
            <>
              <label>Motivo del rechazo (obligatorio)
                <textarea rows={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Qué debería corregirse o por qué no es adecuada" />
              </label>
              <div className="acciones">
                <button type="button" className="peligro" disabled={enviando} onClick={() => decidir("rechazada")}>Confirmar rechazo</button>
                <button type="button" className="sec" disabled={enviando} onClick={() => { setRechazando(false); setError(null); }}>Cancelar</button>
              </div>
            </>
          ) : (
            <div className="acciones">
              <button type="button" disabled={enviando} onClick={() => decidir("aprobada")}>Aprobar</button>
              <button type="button" className="peligro" disabled={enviando} onClick={() => setRechazando(true)}>Rechazar</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
