"use client";

// Paso 1 de la generación: "Qué evaluar". Un recuadro por skill, con nivel, tiempo y los tipos de ítem
// que se piden (con la cantidad de cada uno). Las skills se añaden una a una o desde un rol SFIA (se eligen las que se quieren).
import { Fragment } from "react";
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import type { Box, Level, RoleProfile, RoleProfileDetail, Skill } from "../shared/types";
import { colorDe } from "../shared/categorias";
import { NivelChip, Niveles } from "../shared/Niveles";
import { Ayuda } from "../shared/Ayuda";
import { IconoTipo } from "../shared/IconoTipo";
import { SkillPicker } from "../shared/SkillPicker";
import { RolPicker } from "./RolPicker";
import { DESCRIPCION_TIPO, TEXTO_CANTIDAD, TEXTO_MINUTOS } from "./tipos";

interface Props {
  skills: Skill[];
  niveles: Level[];
  perfiles: RoleProfile[];
  boxes: Box[];
  setBoxes: (b: Box[]) => void;
  cargarPerfil: (id: string) => Promise<RoleProfileDetail>;
}

let siguiente = 1;
/** Tras restaurar recuadros guardados, evita repetir sus claves al crear nuevos. */
export const ajustarContador = (boxes: Box[]) => { siguiente = Math.max(siguiente, ...boxes.map((b) => b.key + 1)); };

// Tiempo estimado por ítem que se propone al marcar cada tipo (el docente lo puede cambiar).
export const MINUTOS_POR_TIPO: Record<string, number> = {
  single_choice: 2, true_false: 1, open_question: 8, debugging: 15, coding: 25, system_design: 30,
};
export const nuevoBox = (skill_id: string, level = 3, open = true): Box => ({
  key: siguiente++, skill_id, level, types: { single_choice: { cantidad: 2, minutos: MINUTOS_POR_TIPO.single_choice } }, open, context: "",
});


/** Resumen de un recuadro (minimizado y Paso 2): skill, nivel y, por cada tipo pedido, su icono, la cantidad y los minutos. */
export function ResumenCompacto({ b, skill, color, conNombre = false }: { b: Box; skill?: Skill; color: string; conNombre?: boolean }) {
  return (
    <span className="resumen-compacto">
      <strong>{skill?.code ?? "—"}</strong>
      {conNombre && <span>{skill?.name}</span>}
      <NivelChip nivel={b.level} color={color} />
      {Object.entries(b.types).map(([tipo, p]) => (
        <span key={tipo} className="tipo-resumen"><IconoTipo tipo={tipo} /> {p.cantidad}× · {p.minutos} min</span>
      ))}
      {Object.keys(b.types).length === 0 && <span className="error">sin tipos de ítem</span>}
      {b.context.trim() && <span className="suave">· contexto: {b.context.trim()}</span>}
    </span>
  );
}

export function StepEvaluar({ skills, niveles, perfiles, boxes, setBoxes, cargarPerfil }: Props) {
  const cambiar = (key: number, cambio: Partial<Box>) => setBoxes(boxes.map((b) => (b.key === key ? { ...b, ...cambio } : b)));

  const alternarTipo = (b: Box, tipo: string) => {
    const types = { ...b.types };
    if (tipo in types) delete types[tipo];
    else types[tipo] = { cantidad: 1, minutos: MINUTOS_POR_TIPO[tipo] ?? 10 };
    cambiar(b.key, { types });
  };

  return (
    <section className="formulario pagina">
      <h3>1. Qué evaluar</h3>
      <div className="acciones">
        <SkillPicker skills={skills} alElegir={(id) => {
          const s = skills.find((x) => x.id === id);
          setBoxes([...boxes, nuevoBox(id, s ? Math.min(Math.max(3, s.min_level), s.max_level) : 3)]);
        }} />
        <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={cargarPerfil} yaEnFormulario={new Set(boxes.map((b) => b.skill_id))}
                   alAgregar={(lista) => setBoxes([...boxes, ...lista.map((s) => nuevoBox(s.id, s.min_level, false))])} />
        <button type="button" className="a-la-derecha" title="Expandir todo" aria-label="Expandir todo" onClick={() => setBoxes(boxes.map((b) => ({ ...b, open: true })))}>⇊</button>
        <button type="button" title="Minimizar todo" aria-label="Minimizar todo" onClick={() => setBoxes(boxes.map((b) => ({ ...b, open: false })))}>⇈</button>
      </div>

      {boxes.map((b) => {
        const skill = skills.find((s) => s.id === b.skill_id);
        const color = colorDe(skill?.category ?? null);
        return (
        <div key={b.key} className="recuadro" style={{ borderLeft: `6px solid ${color}` }}>
          <div className="recuadro-cabecera">
            <button type="button" className="enlace" onClick={() => cambiar(b.key, { open: !b.open })}>
              {b.open ? "▾" : "▸"} {b.open ? skill?.name : <ResumenCompacto b={b} skill={skill} color={color} />}
            </button>
            <button type="button" onClick={() => setBoxes(boxes.filter((x) => x.key !== b.key))} aria-label="Quitar">×</button>
          </div>
          {b.open && (
            <div className="recuadro-cuerpo">
              <div className="fila-skill-nivel">
              <div className="campo-nivel">
                <span>Skill</span>
                <strong className="nombre-skill">{skill?.name ?? "—"}</strong>
              </div>
              <div className="campo-nivel">
                <span>Nivel de responsabilidad</span>
                <Niveles min={skill?.min_level ?? 1} max={skill?.max_level ?? 7} color={color} elegido={b.level}
                         alElegir={(n) => cambiar(b.key, { level: n })} />
                <span className="suave">{b.level} · {niveles.find((n) => n.level === b.level)?.description}
                  {skill && ` (la skill está definida en los niveles ${skill.min_level} a ${skill.max_level})`}</span>
              </div>
              </div>
              <label>Contexto para la skill
                <textarea rows={2} value={b.context} onChange={(e) => cambiar(b.key, { context: e.target.value })}
                          placeholder="Industria, producto, cultura, escala…" />
              </label>
              <fieldset>
                <legend>Tipos de ítem</legend>
                {Object.keys(b.types).length === 0 && <p className="error">Marca al menos un tipo de ítem para esta skill.</p>}
                <div className="tipos-rejilla">
                  <span />
                  <span className="cab"><Ayuda texto={TEXTO_CANTIDAD}>Cantidad</Ayuda></span>
                  <span className="cab ultima"><Ayuda texto={TEXTO_MINUTOS}>Tiempo (min)</Ayuda></span>
                  {Object.entries(NOMBRE_TIPO).map(([tipo, nombre]) => (
                    <Fragment key={tipo}>
                      <label className="check fila-tipo">
                        <input type="checkbox" checked={tipo in b.types} onChange={() => alternarTipo(b, tipo)} />
                        <IconoTipo tipo={tipo} decorativo />
                        <Ayuda texto={DESCRIPCION_TIPO[tipo]}>{nombre}</Ayuda>
                      </label>
                      {/* Los campos se dibujan siempre (ocultos si el tipo no está marcado) para que la fila no cambie de alto. */}
                      <input type="number" min="1" max="10" aria-label={`Cantidad ${nombre}`} disabled={!(tipo in b.types)}
                             style={{ visibility: tipo in b.types ? "visible" : "hidden" }}
                             value={b.types[tipo]?.cantidad ?? 1}
                             onChange={(e) => cambiar(b.key, { types: { ...b.types, [tipo]: { ...b.types[tipo], cantidad: Number(e.target.value) } } })} />
                      <input type="number" min="1" aria-label={`Minutos ${nombre}`} disabled={!(tipo in b.types)}
                             style={{ visibility: tipo in b.types ? "visible" : "hidden" }}
                             value={b.types[tipo]?.minutos ?? MINUTOS_POR_TIPO[tipo] ?? 10}
                             onChange={(e) => cambiar(b.key, { types: { ...b.types, [tipo]: { ...b.types[tipo], minutos: Number(e.target.value) } } })} />
                    </Fragment>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>
        );
      })}
      {boxes.length === 0 && <p className="suave">Añade al menos una skill, o las skills de un rol SFIA.</p>}
    </section>
  );
}
