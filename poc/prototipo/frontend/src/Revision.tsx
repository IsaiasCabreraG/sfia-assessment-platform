import { useState } from "react";
import { publicar, regenerar } from "./api";
import type { Borrador, Formulario } from "./tipos";

type Props = {
  formulario: Formulario;
  borradores: Borrador[];
  onCambio: (b: Borrador[]) => void;
  onVolver: () => void;
};

const lineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

function Tarjeta({ b, bloqueada, ocupado, onActualizar, onRegenerar }: {
  b: Borrador; bloqueada: boolean; ocupado: boolean;
  onActualizar: (b: Borrador) => void; onRegenerar: (feedback: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [enunciado, setEnunciado] = useState(b.enunciado);
  const [rubrica, setRubrica] = useState(b.rubrica.join("\n"));
  const [criterios, setCriterios] = useState(b.criterios_aceptacion.join("\n"));
  const [pidiendo, setPidiendo] = useState(false); // panel de feedback para regenerar
  const [feedback, setFeedback] = useState("");

  function abrirEdicion() {
    setEnunciado(b.enunciado);
    setRubrica(b.rubrica.join("\n"));
    setCriterios(b.criterios_aceptacion.join("\n"));
    setEditando(true);
  }

  function guardar() {
    onActualizar({ ...b, enunciado, rubrica: lineas(rubrica), criterios_aceptacion: lineas(criterios) });
    setEditando(false);
  }

  function confirmarRegenerar() {
    onRegenerar(feedback);
    setPidiendo(false);
    setFeedback("");
  }

  return (
    <article className={`borrador ${b.estado}`}>
      <header>
        <span className="etq">{b.skill} · nivel {b.nivel}</span>
        <span className="etq">{b.tipo}</span>
        <span className="etq">{b.dificultad}</span>
        <span className="etq">{b.tiempo_min} min</span>
        <span className={`estado ${b.estado}`}>{b.estado === "draft" ? "borrador" : "descartado"}</span>
      </header>

      {editando ? (
        <>
          <label>Enunciado<textarea rows={5} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} /></label>
          <label>Rúbrica (un criterio por línea)<textarea rows={3} value={rubrica} onChange={(e) => setRubrica(e.target.value)} /></label>
          <label>Criterios de aceptación (uno por línea)<textarea rows={3} value={criterios} onChange={(e) => setCriterios(e.target.value)} /></label>
          <div className="acciones">
            <button type="button" onClick={guardar}>Guardar</button>
            <button type="button" className="sec" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <p className="enunciado">{b.enunciado}</p>
          <details>
            <summary>Rúbrica y criterios de aceptación</summary>
            <h4>Rúbrica</h4>
            <ul>{b.rubrica.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <h4>Criterios de aceptación</h4>
            <ul>{b.criterios_aceptacion.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </details>

          {pidiendo && (
            <div className="feedback">
              <label>Feedback para el LLM (opcional)
                <textarea rows={3} autoFocus placeholder="Qué cambiarías: más difícil, otro enfoque, usar tal tecnología…"
                  value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </label>
              <div className="acciones">
                <button type="button" onClick={confirmarRegenerar}>Regenerar</button>
                <button type="button" className="sec" onClick={() => setPidiendo(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {!pidiendo && !bloqueada && (
            <div className="acciones">
              {b.estado === "descartado" ? (
                <button type="button" className="sec" onClick={() => onActualizar({ ...b, estado: "draft" })}>Restaurar</button>
              ) : (
                <>
                  <button type="button" className="sec" onClick={abrirEdicion}>Editar</button>
                  <button type="button" className="sec" disabled={ocupado} onClick={() => setPidiendo(true)}>{ocupado ? "Regenerando…" : "Regenerar"}</button>
                  <button type="button" className="peligro" onClick={() => onActualizar({ ...b, estado: "descartado" })}>Descartar</button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function Revision({ formulario, borradores, onCambio, onVolver }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expertos, setExpertos] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicadas, setPublicadas] = useState<number | null>(null);

  const reemplazar = (nuevo: Borrador, idViejo = nuevo.id) =>
    onCambio(borradores.map((b) => (b.id === idViejo ? nuevo : b)));

  async function pedirOtro(b: Borrador, feedback: string) {
    setOcupado(b.id);
    setError(null);
    try {
      reemplazar(await regenerar(formulario, b, feedback), b.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const vigentes = borradores.filter((b) => b.estado === "draft");

  async function lanzarPublicacion() {
    setPublicando(true);
    setError(null);
    try {
      setPublicadas((await publicar(vigentes, expertos)).publicados);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublicando(false);
    }
  }

  const bloqueada = publicadas !== null;

  return (
    <>
      <h1>Revisión de borradores</h1>
      <p className="ayuda">
        {borradores.length} generados · {vigentes.length} se publicarían · {borradores.length - vigentes.length} descartados
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {borradores.map((b) => (
        <Tarjeta key={b.id} b={b} bloqueada={bloqueada} ocupado={ocupado === b.id}
          onActualizar={(n) => reemplazar(n)} onRegenerar={(fb) => pedirOtro(b, fb)} />
      ))}

      {bloqueada ? (
        <section className="tarjeta exito">
          <p><b>Se publicaron {publicadas} preguntas.</b>{" "}
            {expertos ? "Están a disposición de los expertos para su revisión." : "Quedan de uso privado."}</p>
          <div className="acciones">
            <button type="button" onClick={onVolver}>Generar más preguntas</button>
          </div>
        </section>
      ) : (
        <section className="tarjeta publicar">
          <label className="fila destacada">
            <input type="checkbox" checked={expertos} onChange={(e) => setExpertos(e.target.checked)} />
            <span>
              Dejar las preguntas a disposición de expertos para evaluar
              <small>{expertos ? "Los expertos podrán validar estas preguntas." : "Desmarcado: las preguntas son de uso privado."}</small>
            </span>
          </label>
          <div className="acciones">
            <button type="button" onClick={lanzarPublicacion} disabled={publicando || vigentes.length === 0}>
              {publicando ? "Publicando…" : `Publicar ${vigentes.length} preguntas`}
            </button>
            <button type="button" className="sec" onClick={onVolver} disabled={publicando}>Volver al formulario</button>
          </div>
        </section>
      )}
    </>
  );
}
