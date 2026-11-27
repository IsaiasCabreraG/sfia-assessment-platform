"use client";

// Edición de un borrador antes de publicar. Muestra los campos propios de cada tipo de ítem; las reglas
// (pesos de la rúbrica que suman 100, una sola opción correcta, etc.) las valida el backend al publicar.
import { Icono } from "../shared/Estrellas";
import { CRITERIOS_FIJOS, OPEN_TYPES, type CriterioRubrica } from "./tipos";

type Contenido = Record<string, any>;
interface Props {
  type: string;
  content: Contenido;
  onChange: (c: Contenido) => void;
}

function Texto({ etiqueta, valor, onChange, filas = 0 }: { etiqueta: string; valor: string | null; onChange: (v: string) => void; filas?: number }) {
  return (
    <label>{etiqueta}
      {filas > 0
        ? <textarea rows={filas} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />
        : <input value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Numero({ etiqueta, valor, onChange }: { etiqueta: string; valor: number | null; onChange: (v: number) => void }) {
  return (
    <label>{etiqueta}
      <input type="number" min="1" value={valor ?? ""} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Lista de textos, uno por línea. */
function Lineas({ etiqueta, valor, onChange }: { etiqueta: string; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <label>{etiqueta} (una por línea)
      <textarea rows={3} value={valor.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </label>
  );
}

function Opciones({ c, set }: { c: Contenido; set: (cambio: Contenido) => void }) {
  const opciones: { text: string; is_correct: boolean }[] = c.options;
  const cambiar = (i: number, cambio: Partial<{ text: string; is_correct: boolean }>) =>
    set({ options: opciones.map((o, j) => (j === i ? { ...o, ...cambio } : o)) });
  return (
    <fieldset>
      <legend>Alternativas (marca la correcta)</legend>
      {opciones.map((o, i) => (
        <div key={i} className="tipo-fila">
          <span className="letra">{String.fromCharCode(65 + i)}</span>
          <input type="radio" name="correcta" checked={o.is_correct}
                 onChange={() => set({ options: opciones.map((x, j) => ({ ...x, is_correct: j === i })) })} />
          <input className="crece" value={o.text} onChange={(e) => cambiar(i, { text: e.target.value })} />
          <button type="button" className="icono-btn peligro" aria-label="Quitar" title="Quitar" disabled={opciones.length <= 2} onClick={() => set({ options: opciones.filter((_, j) => j !== i) })}><Icono nombre="descartar" /></button>
        </div>
      ))}
      <button type="button" onClick={() => set({ options: [...opciones, { text: "", is_correct: false }] })}>+ Alternativa</button>
    </fieldset>
  );
}

function Hallazgos({ c, set }: { c: Contenido; set: (cambio: Contenido) => void }) {
  const hallazgos: { line: number | null; description: string }[] = c.findings;
  const cambiar = (i: number, cambio: Partial<{ line: number | null; description: string }>) =>
    set({ findings: hallazgos.map((h, j) => (j === i ? { ...h, ...cambio } : h)) });
  return (
    <fieldset>
      <legend>Hallazgos esperados</legend>
      {hallazgos.map((h, i) => (
        <div key={i} className="tipo-fila">
          <input type="number" min="1" placeholder="Línea" className="corto" value={h.line ?? ""}
                 onChange={(e) => cambiar(i, { line: e.target.value ? Number(e.target.value) : null })} />
          <input className="crece" placeholder="Causa esperada" value={h.description} onChange={(e) => cambiar(i, { description: e.target.value })} />
          <button type="button" className="icono-btn peligro" aria-label="Quitar" title="Quitar" disabled={hallazgos.length <= 1} onClick={() => set({ findings: hallazgos.filter((_, j) => j !== i) })}><Icono nombre="descartar" /></button>
        </div>
      ))}
      <button type="button" onClick={() => set({ findings: [...hallazgos, { line: null, description: "" }] })}>+ Hallazgo</button>
    </fieldset>
  );
}

function Rubrica({ type, c, set }: { type: string; c: Contenido; set: (cambio: Contenido) => void }) {
  type Criterio = CriterioRubrica;
  const criterios: Criterio[] = c.rubric;
  const suma = criterios.reduce((t, x) => t + (x.weight || 0), 0);
  // Los criterios fijos del tipo (config/criterios-fijos.json) están bloqueados; los demás se pueden editar, quitar y agregar.
  const nombresFijos = (CRITERIOS_FIJOS[type] ?? []).map((f) => f.name.toLowerCase());
  const esFijo = (k: Criterio) => nombresFijos.includes(k.name.trim().toLowerCase());
  const cambiar = (i: number, cambio: Partial<Criterio>) => set({ rubric: criterios.map((x, j) => (j === i ? { ...x, ...cambio } : x)) });
  const nuevo = (): Criterio => ({ name: "", weight: 10, levels: [0, 1, 2, 3].map((score) => ({ score, descriptor: "" })) });
  return (
    <fieldset>
      <legend>Rúbrica — los pesos suman <strong className={suma === 100 ? "ok" : "error"}>{suma}</strong> (deben sumar 100). Los criterios fijos del tipo están bloqueados</legend>
      {criterios.map((k, i) => {
        const fijo = esFijo(k);
        return (
        <div key={i} className="criterio">
          <div className="tipo-fila">
            <input className="crece" placeholder="Criterio" value={k.name} disabled={fijo} onChange={(e) => cambiar(i, { name: e.target.value })} />
            <input type="number" min="1" max="100" className="corto" value={k.weight} disabled={fijo} onChange={(e) => cambiar(i, { weight: Number(e.target.value) })} />
            <span>%</span>
            <button type="button" className="icono-btn peligro" aria-label="Quitar" title="Quitar" disabled={fijo || criterios.length <= 4} onClick={() => set({ rubric: criterios.filter((_, j) => j !== i) })}><Icono nombre="descartar" /></button>
          </div>
          {k.levels.map((l, n) => (
            <label key={l.score}>Puntaje {l.score}
              <input value={l.descriptor} disabled={fijo}
                     onChange={(e) => cambiar(i, { levels: k.levels.map((x, m) => (m === n ? { ...x, descriptor: e.target.value } : x)) })} />
            </label>
          ))}
        </div>
        );
      })}
      <button type="button" onClick={() => set({ rubric: [...criterios, nuevo()] })}>+ Criterio</button>
    </fieldset>
  );
}

export function DraftEditor({ type, content, onChange }: Props) {
  const c = content;
  const set = (cambio: Contenido) => onChange({ ...c, ...cambio });
  // El orden es el mismo que en la vista del borrador (VistaItem): primero lo que verá quien rinda y luego lo que solo ve el docente/reclutador.
  return (
    <div className="editor">
      <Texto etiqueta="Enunciado" valor={c.statement} filas={4} onChange={(v) => set({ statement: v })} />

      {/* Lo que verá quien rinda */}
      {type === "single_choice" && <Opciones c={c} set={set} />}

      {type === "coding" && (
        <>
          <Texto etiqueta="Lenguaje" valor={c.language} onChange={(v) => set({ language: v })} />
          <Texto etiqueta="Firma de la función" valor={c.function_signature} onChange={(v) => set({ function_signature: v })} />
          <Texto etiqueta="Código inicial" valor={c.starter_code} filas={4} onChange={(v) => set({ starter_code: v })} />
        </>
      )}

      {type === "system_design" && (
        <>
          <Texto etiqueta="Escenario" valor={c.scenario} filas={3} onChange={(v) => set({ scenario: v })} />
          <Lineas etiqueta="Requisitos funcionales" valor={c.functional_requirements} onChange={(v) => set({ functional_requirements: v })} />
          <Lineas etiqueta="Requisitos no funcionales" valor={c.non_functional_requirements} onChange={(v) => set({ non_functional_requirements: v })} />
          <Lineas etiqueta="Restricciones" valor={c.constraints} onChange={(v) => set({ constraints: v })} />
        </>
      )}

      {type === "debugging" && (
        <>
          <Texto etiqueta="Lenguaje" valor={c.language} onChange={(v) => set({ language: v })} />
          <Texto etiqueta="Código con el defecto" valor={c.code} filas={6} onChange={(v) => set({ code: v })} />
          <Texto etiqueta="Entrada que reproduce el fallo" valor={c.symptom_input} onChange={(v) => set({ symptom_input: v })} />
          <Texto etiqueta="Resultado esperado" valor={c.symptom_expected} onChange={(v) => set({ symptom_expected: v })} />
          <Texto etiqueta="Resultado obtenido" valor={c.symptom_observed} onChange={(v) => set({ symptom_observed: v })} />
        </>
      )}

      {/* Solo para el docente */}
      <Texto etiqueta="Qué evalúa" valor={c.evaluation_goal} filas={2} onChange={(v) => set({ evaluation_goal: v })} />

      {type === "true_false" && (
        <label>Respuesta correcta
          <select value={String(c.correct_answer)} onChange={(e) => set({ correct_answer: e.target.value === "true" })}>
            <option value="true">Verdadero</option>
            <option value="false">Falso</option>
          </select>
        </label>
      )}

      {(type === "open_question" || type === "system_design") && (
        <Texto etiqueta="Respuesta de referencia" valor={c.reference_answer} filas={4} onChange={(v) => set({ reference_answer: v })} />
      )}

      {type === "coding" && (
        <>
          <Texto etiqueta="Tests unitarios" valor={c.unit_tests} filas={5} onChange={(v) => set({ unit_tests: v })} />
          <Texto etiqueta="Solución de referencia" valor={c.reference_solution} filas={5} onChange={(v) => set({ reference_solution: v })} />
          <Numero etiqueta="Límite de tiempo (s)" valor={c.time_limit_seconds} onChange={(v) => set({ time_limit_seconds: v })} />
          <Numero etiqueta="Límite de memoria (MB)" valor={c.memory_limit_mb} onChange={(v) => set({ memory_limit_mb: v })} />
        </>
      )}

      {type === "debugging" && (
        <>
          <Hallazgos c={c} set={set} />
          <Texto etiqueta="Corrección de referencia" valor={c.reference_answer} filas={3} onChange={(v) => set({ reference_answer: v })} />
        </>
      )}

      {OPEN_TYPES.has(type) && <Rubrica type={type} c={c} set={set} />}
    </div>
  );
}
