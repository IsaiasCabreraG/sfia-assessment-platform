"use client";

// Un ítem completo (borrador, banco de ítems y portal del experto se ven igual), separado en lo que verá quien rinda
// (marco azul) y lo que solo ve el docente/reclutador (marco punteado), para saber cómo se presentará la pregunta
// (HU-27-6). La rúbrica se muestra como matriz de criterios por niveles (HU-27-4).
import type { ReactNode } from "react";
import type { RubricCriterion } from "./types";

type Contenido = Record<string, any>;

/** Rúbrica como matriz: un criterio por fila y un nivel (puntaje 0 a 3) por columna. */
export function Rubrica({ criterios }: { criterios: RubricCriterion[] }) {
  return (
    <table className="rubrica">
      <thead>
        <tr>
          <th>Criterio (peso)</th>
          {[0, 1, 2, 3].map((p) => <th key={p}>{p}</th>)}
        </tr>
      </thead>
      <tbody>
        {criterios.map((c) => (
          <tr key={c.name}>
            <td>{c.name} ({c.weight}%)</td>
            {[...c.levels].sort((a, b) => a.score - b.score).map((l) => <td key={l.score}>{l.descriptor}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="dato"><h5>{titulo}</h5>{children}</div>;
}

function Codigo({ texto }: { texto: string | null }) {
  return texto ? <pre>{texto}</pre> : <p className="suave">—</p>;
}

function Lista({ items }: { items: string[] | null }) {
  return items && items.length > 0 ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="suave">—</p>;
}

/** Lo que ve el alumno/postulante al rendir el ítem (sin la respuesta correcta). */
function ParaElAlumno({ type, c }: { type: string; c: Contenido }) {
  return (
    <>
      <Dato titulo="Enunciado"><p className="enunciado-completo">{c.statement}</p></Dato>
      {type === "single_choice" && (
        <Dato titulo="Alternativas">
          <ol className="alternativas">{(c.options ?? []).map((o: { text: string }, i: number) => <li key={i}>{o.text}</li>)}</ol>
        </Dato>
      )}
      {type === "true_false" && <Dato titulo="Respuesta"><p>Verdadero o falso</p></Dato>}
      {type === "coding" && (
        <>
          <Dato titulo={`Firma (${c.language})`}><Codigo texto={c.function_signature} /></Dato>
          {c.starter_code && <Dato titulo="Código inicial"><Codigo texto={c.starter_code} /></Dato>}
        </>
      )}
      {type === "system_design" && (
        <>
          <Dato titulo="Escenario"><p>{c.scenario}</p></Dato>
          <Dato titulo="Requisitos funcionales"><Lista items={c.functional_requirements} /></Dato>
          {c.non_functional_requirements?.length > 0 && <Dato titulo="Requisitos no funcionales"><Lista items={c.non_functional_requirements} /></Dato>}
          {c.constraints?.length > 0 && <Dato titulo="Restricciones"><Lista items={c.constraints} /></Dato>}
        </>
      )}
      {type === "debugging" && (
        <>
          <Dato titulo={`Código (${c.language})`}><Codigo texto={c.code} /></Dato>
          <Dato titulo="Síntoma">
            <p>Entrada: {c.symptom_input ?? "—"}</p>
            <p>Esperado: {c.symptom_expected}</p>
            <p>Obtenido: {c.symptom_observed}</p>
          </Dato>
        </>
      )}
    </>
  );
}

/** Lo que solo ve el docente: qué evalúa, la respuesta correcta o de referencia y la rúbrica. */
function SoloDocente({ type, c }: { type: string; c: Contenido }) {
  const correcta = type === "single_choice" ? c.options.findIndex((o: { is_correct: boolean }) => o.is_correct) : -1;
  return (
    <>
      <Dato titulo="Qué evalúa"><p>{c.evaluation_goal}</p></Dato>
      {type === "single_choice" && (
        <Dato titulo="Alternativa correcta"><p>{correcta >= 0 ? `${String.fromCharCode(65 + correcta)}. ${c.options[correcta].text}` : "—"}</p></Dato>
      )}
      {type === "true_false" && <Dato titulo="Respuesta correcta"><p>{c.correct_answer ? "Verdadero" : "Falso"}</p></Dato>}
      {(type === "open_question" || type === "system_design") && <Dato titulo="Respuesta de referencia"><p>{c.reference_answer}</p></Dato>}
      {type === "coding" && (
        <>
          <Dato titulo="Tests unitarios"><Codigo texto={c.unit_tests} /></Dato>
          <Dato titulo="Solución de referencia"><Codigo texto={c.reference_solution} /></Dato>
          <p className="suave">Límites: {c.time_limit_seconds} s, {c.memory_limit_mb} MB</p>
        </>
      )}
      {type === "debugging" && (
        <>
          <Dato titulo="Hallazgos esperados">
            <ul>{c.findings.map((f: { line: number | null; description: string }, i: number) => <li key={i}>{f.line ? `Línea ${f.line}: ` : ""}{f.description}</li>)}</ul>
          </Dato>
          <Dato titulo="Corrección de referencia"><p>{c.reference_answer}</p></Dato>
        </>
      )}
      {c.rubric && <Dato titulo="Rúbrica"><div className="tabla-ancha"><Rubrica criterios={c.rubric} /></div></Dato>}
    </>
  );
}

export function VistaItem({ type, c }: { type: string; c: Contenido }) {
  return (
    <div className="vista-borrador">
      <section className="vista-alumno">
        <h4>Lo que verá quien rinda</h4>
        <ParaElAlumno type={type} c={c} />
      </section>
      <section className="vista-docente">
        <h4>Solo para el docente/reclutador</h4>
        <SoloDocente type={type} c={c} />
      </section>
    </div>
  );
}
