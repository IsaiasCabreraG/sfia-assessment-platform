// Atributos completos de un ítem (HU-08): skill, nivel, tiempo, enunciado, respuesta correcta o
// rúbrica según el tipo, y su puntuación (HU-25).
import type { ItemDetailData, RubricCriterion } from "./types";

export const NOMBRE_TIPO: Record<string, string> = {
  single_choice: "Alternativa única",
  true_false: "Verdadero o falso",
  open_question: "Pregunta de desarrollo",
  coding: "Coding challenge",
  system_design: "System design",
  debugging: "Debugging",
};

export function Puntuacion({ promedio, cantidad }: { promedio: number | null; cantidad: number }) {
  // Sin puntuaciones no se muestra nada (distinto de un promedio de 0.0, que sí se muestra con su estrella).
  if (cantidad === 0 || promedio === null) return null;
  return (
    <span className="etiqueta puntuado">
      ★ {Number(promedio).toFixed(1)} ({cantidad} {cantidad === 1 ? "puntuación" : "puntuaciones"})
    </span>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="campo">
      <h4>{titulo}</h4>
      {children}
    </section>
  );
}

function Codigo({ texto }: { texto: string | null }) {
  return texto ? <pre>{texto}</pre> : <p className="suave">—</p>;
}

function Rubrica({ criterios }: { criterios: RubricCriterion[] }) {
  return (
    <table className="rubrica">
      <thead>
        <tr>
          <th>Criterio (peso)</th>
          {[0, 1, 2, 3].map((p) => (
            <th key={p}>{p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {criterios.map((c) => (
          <tr key={c.name}>
            <td>
              {c.name} ({c.weight}%)
            </td>
            {c.levels.map((l) => (
              <td key={l.score}>{l.descriptor}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Contenido propio de cada tipo, incluida la respuesta correcta o de referencia. */
function ContenidoDelTipo({ item }: { item: ItemDetailData }) {
  const c = item.content;
  switch (item.type) {
    case "single_choice":
      return (
        <Campo titulo="Opciones">
          <ol className="alternativas">
            {c.options.map((o: { position: number; text: string; is_correct: boolean }) => (
              <li key={o.position} className={o.is_correct ? "correcta" : ""}>
                {o.text} {o.is_correct && <strong>(correcta)</strong>}
              </li>
            ))}
          </ol>
        </Campo>
      );
    case "true_false":
      return (
        <Campo titulo="Respuesta correcta">
          <p>{c.correct_answer ? "Verdadero" : "Falso"}</p>
        </Campo>
      );
    case "open_question":
      return (
        <Campo titulo="Respuesta de referencia">
          <p>{c.reference_answer}</p>
        </Campo>
      );
    case "coding":
      return (
        <>
          <Campo titulo={`Firma (${c.language})`}>
            <Codigo texto={c.function_signature} />
          </Campo>
          <Campo titulo="Código inicial">
            <Codigo texto={c.starter_code} />
          </Campo>
          <Campo titulo="Tests unitarios">
            <Codigo texto={c.unit_tests} />
          </Campo>
          <Campo titulo="Solución de referencia">
            <Codigo texto={c.reference_solution} />
          </Campo>
          <p className="suave">
            Límites: {c.time_limit_seconds} s, {c.memory_limit_mb} MB
          </p>
        </>
      );
    case "system_design":
      return (
        <>
          <Campo titulo="Escenario">
            <p>{c.scenario}</p>
          </Campo>
          <Campo titulo="Requisitos funcionales">
            <ul>{c.functional_requirements.map((r: string) => <li key={r}>{r}</li>)}</ul>
          </Campo>
          {c.non_functional_requirements?.length > 0 && (
            <Campo titulo="Requisitos no funcionales">
              <ul>{c.non_functional_requirements.map((r: string) => <li key={r}>{r}</li>)}</ul>
            </Campo>
          )}
          {c.constraints?.length > 0 && (
            <Campo titulo="Restricciones">
              <ul>{c.constraints.map((r: string) => <li key={r}>{r}</li>)}</ul>
            </Campo>
          )}
          <Campo titulo="Respuesta de referencia">
            <p>{c.reference_answer}</p>
          </Campo>
        </>
      );
    case "debugging":
      return (
        <>
          <Campo titulo={`Código (${c.language})`}>
            <Codigo texto={c.code} />
          </Campo>
          <Campo titulo="Síntoma">
            <p>Entrada: {c.symptom_input ?? "—"}</p>
            <p>Esperado: {c.symptom_expected}</p>
            <p>Obtenido: {c.symptom_observed}</p>
          </Campo>
          <Campo titulo="Hallazgos esperados">
            <ul>
              {c.findings.map((f: { line: number | null; description: string }, i: number) => (
                <li key={i}>
                  {f.line ? `Línea ${f.line}: ` : ""}
                  {f.description}
                </li>
              ))}
            </ul>
          </Campo>
          <Campo titulo="Corrección de referencia">
            <p>{c.reference_answer}</p>
          </Campo>
        </>
      );
    default:
      return null;
  }
}

export function ItemDetail({ item }: { item: ItemDetailData }) {
  return (
    <article className="detalle">
      <header>
        <div className="fila-titulo">
          <h3>
            {item.skill.code} · {item.skill.name}
          </h3>
          <Puntuacion promedio={item.score.average} cantidad={item.score.count} />
        </div>
        <p className="suave">
          {NOMBRE_TIPO[item.type] ?? item.type} · nivel {item.level} · {item.estimated_minutes} min · versión{" "}
          {item.version} · {item.status === "active" ? "activo" : "inactivo"} ·{" "}
          {item.available_to_experts ? "disponible para expertos" : "uso privado"}
        </p>
      </header>
      <Campo titulo="Enunciado">
        <p>{item.statement}</p>
      </Campo>
      <Campo titulo="Qué evalúa">
        <p>{item.evaluation_goal}</p>
      </Campo>
      <ContenidoDelTipo item={item} />
      {item.rubric && (
        <Campo titulo="Rúbrica">
          <Rubrica criterios={item.rubric} />
        </Campo>
      )}
    </article>
  );
}
