import { useState } from "react";
import { leerArchivos } from "./api";
import type { Archivo, Formulario } from "./tipos";
import { resumenBloque } from "./tipos";

type Props = { f: Formulario; cambiar: (p: Partial<Formulario>) => void };

// ---------- Paso 2: contexto ----------
function SubirArchivos({ etiqueta, archivos, onChange, onError }: {
  etiqueta: string; archivos: Archivo[]; onChange: (a: Archivo[]) => void; onError: (m: string | null) => void;
}) {
  return (
    <div className="archivos">
      <label className="boton-archivo">
        {etiqueta}
        <input type="file" multiple accept=".txt,.md,.json,.csv,.yaml,.yml,.html" hidden
          onChange={async (e) => {
            try {
              onError(null);
              onChange([...archivos, ...(await leerArchivos(e.target.files))]);
            } catch (err) {
              onError((err as Error).message);
            }
            e.target.value = "";
          }} />
      </label>
      {archivos.map((a) => (
        <span key={a.nombre} className="chip">
          {a.nombre}
          <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => onChange(archivos.filter((x) => x !== a))}>×</button>
        </span>
      ))}
    </div>
  );
}

export function PasoContexto({ f, cambiar, onError }: Props & { onError: (m: string | null) => void }) {
  const [tag, setTag] = useState("");

  function agregarTag() {
    const t = tag.trim().replace(/,$/, "");
    if (t && !f.stack.includes(t)) cambiar({ stack: [...f.stack, t] });
    setTag("");
  }

  return (
    <>
      <label>Contexto
        <textarea rows={4} placeholder="Empresa, cargo o curso: industria, producto, cultura, escala…"
          value={f.contexto.texto} onChange={(e) => cambiar({ contexto: { ...f.contexto, texto: e.target.value } })} />
      </label>
      <SubirArchivos etiqueta="Adjuntar archivo de contexto" archivos={f.contexto.archivos} onError={onError}
        onChange={(archivos) => cambiar({ contexto: { ...f.contexto, archivos } })} />

      <label>Descripción del cargo
        <textarea rows={4} placeholder="Job Description o equivalente"
          value={f.cargo.texto} onChange={(e) => cambiar({ cargo: { ...f.cargo, texto: e.target.value } })} />
      </label>
      <SubirArchivos etiqueta="Adjuntar descripción del cargo" archivos={f.cargo.archivos} onError={onError}
        onChange={(archivos) => cambiar({ cargo: { ...f.cargo, archivos } })} />

      <label>Stack tecnológico
        <input value={tag} placeholder="Escribe y presiona Enter (ej. Python, React, PostgreSQL)"
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); agregarTag(); } }}
          onBlur={agregarTag} />
      </label>
      <div className="archivos">
        {f.stack.map((t) => (
          <span key={t} className="chip">{t}
            <button type="button" aria-label={`Quitar ${t}`} onClick={() => cambiar({ stack: f.stack.filter((x) => x !== t) })}>×</button>
          </span>
        ))}
      </div>

      <p className="etiqueta">Documentos de referencia</p>
      <p className="ayuda">Estándares internos, arquitectura, syllabus. El LLM los usa como fuente.</p>
      <SubirArchivos etiqueta="Adjuntar documentos" archivos={f.referencias} onError={onError}
        onChange={(referencias) => cambiar({ referencias })} />

      <label>Restricciones e instrucciones extra
        <textarea rows={3} placeholder="Temas a evitar, idioma, tono, formato…"
          value={f.restricciones} onChange={(e) => cambiar({ restricciones: e.target.value })} />
      </label>
    </>
  );
}

// ---------- Paso 3: resumen ----------
export function PasoResumen({ f, irA }: Props & { irA: (p: number) => void }) {
  const total = f.bloques.reduce((a, b) => a + b.tipos.reduce((c, t) => c + t.cantidad, 0), 0);
  const nArchivos = f.contexto.archivos.length + f.cargo.archivos.length + f.referencias.length;
  const corto = (t: string) => (t.trim() ? (t.length > 90 ? t.slice(0, 90) + "…" : t) : "—");

  return (
    <>
      <div className="resumen">
        <div>
          <h3>Qué evaluar <button type="button" className="enlace" onClick={() => irA(0)}>Editar</button></h3>
          <ul>
            {f.bloques.map((b) => <li key={b.uid}><b>{b.codigo}</b> nivel {b.nivel}: {resumenBloque(b)}</li>)}
          </ul>
          <p><b>Total: {total} ítems</b></p>
        </div>
        <div>
          <h3>Contexto <button type="button" className="enlace" onClick={() => irA(1)}>Editar</button></h3>
          <p><b>Contexto:</b> {corto(f.contexto.texto)}</p>
          <p><b>Cargo:</b> {corto(f.cargo.texto)}</p>
          <p><b>Stack:</b> {f.stack.join(", ") || "—"}</p>
          <p><b>Archivos adjuntos:</b> {nArchivos}</p>
          <p><b>Restricciones:</b> {corto(f.restricciones)}</p>
        </div>
      </div>
    </>
  );
}
