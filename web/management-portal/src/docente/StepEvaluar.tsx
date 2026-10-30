"use client";

// Paso 1 de la generación: "Qué evaluar". Un recuadro por skill, con nivel, tiempo y los tipos de ítem
// que se piden (con la cantidad de cada uno). El rol SFIA precarga los recuadros de sus skills.
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import type { Box, Level, RoleProfile, RoleProfileDetail, Skill } from "../shared/types";
import { colorDe } from "../shared/categorias";
import { Niveles } from "../shared/Niveles";
import { SkillPicker } from "../shared/SkillPicker";

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

export function resumenBox(b: Box, skills: Skill[]): string {
  const skill = skills.find((s) => s.id === b.skill_id);
  const tipos = Object.entries(b.types).map(([t, p]) => `${p.cantidad}× ${NOMBRE_TIPO[t]} (${p.minutos} min c/u)`).join(", ");
  return `${skill?.code ?? "—"} · nivel ${b.level} · ${tipos || "sin tipos"}${b.context.trim() ? ` · contexto: ${b.context.trim()}` : ""}`;
}

export function StepEvaluar({ skills, niveles, perfiles, boxes, setBoxes, cargarPerfil }: Props) {
  const cambiar = (key: number, cambio: Partial<Box>) => setBoxes(boxes.map((b) => (b.key === key ? { ...b, ...cambio } : b)));

  const elegirRol = async (id: string) => {
    if (!id) return; // volver a "Rol personalizado" conserva los recuadros
    if (boxes.length > 0 && !window.confirm("Se reemplazarán los recuadros actuales por los del rol. ¿Continuar?")) return;
    const perfil = await cargarPerfil(id);
    setBoxes(perfil.skills.map((s) => nuevoBox(s.id, s.min_level, false)));
  };

  const alternarTipo = (b: Box, tipo: string) => {
    const types = { ...b.types };
    if (tipo in types) delete types[tipo];
    else types[tipo] = { cantidad: 1, minutos: MINUTOS_POR_TIPO[tipo] ?? 10 };
    cambiar(b.key, { types });
  };

  return (
    <section className="formulario ancho">
      <h3>1. Qué evaluar</h3>
      <label>Rol SFIA
        <select value="" onChange={(e) => elegirRol(e.target.value)}>
          <option value="">Rol personalizado</option>
          {perfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="acciones">
        <SkillPicker skills={skills} alElegir={(id) => {
          const s = skills.find((x) => x.id === id);
          setBoxes([...boxes, nuevoBox(id, s ? Math.min(Math.max(3, s.min_level), s.max_level) : 3)]);
        }} />
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
              {b.open ? "▾" : "▸"} {b.open ? skills.find((s) => s.id === b.skill_id)?.name : resumenBox(b, skills)}
            </button>
            <button type="button" onClick={() => setBoxes(boxes.filter((x) => x.key !== b.key))} aria-label="Quitar">×</button>
          </div>
          {b.open && (
            <div className="recuadro-cuerpo">
              <div className="campo-nivel">
                <span>Skill</span>
                <div className="acciones">
                  <SkillPicker skills={skills} texto={skill ? `${skill.code} · ${skill.name} ▾` : "Elegir skill ▾"}
                               alElegir={(id) => {
                                 const n = skills.find((x) => x.id === id);
                                 cambiar(b.key, { skill_id: id, level: n ? Math.min(Math.max(b.level, n.min_level), n.max_level) : b.level });
                               }} />
                </div>
              </div>
              <div className="campo-nivel">
                <span>Nivel de responsabilidad</span>
                <Niveles min={skill?.min_level ?? 1} max={skill?.max_level ?? 7} color={color} elegido={b.level}
                         alElegir={(n) => cambiar(b.key, { level: n })} />
                <span className="suave">{b.level} · {niveles.find((n) => n.level === b.level)?.description}
                  {skill && ` (la skill está definida en los niveles ${skill.min_level} a ${skill.max_level})`}</span>
              </div>
              <label>Contexto de esta skill (opcional: empresa, cargo o curso)
                <textarea rows={2} value={b.context} onChange={(e) => cambiar(b.key, { context: e.target.value })}
                          placeholder="Industria, producto, cultura, escala…" />
              </label>
              <fieldset>
                <legend>Tipos de ejercicio: cantidad y tiempo estimado por ítem</legend>
                {Object.entries(NOMBRE_TIPO).map(([tipo, nombre]) => (
                  <div key={tipo} className="tipo-fila">
                    <label className="check">
                      <input type="checkbox" checked={tipo in b.types} onChange={() => alternarTipo(b, tipo)} /> {nombre}
                    </label>
                    {/* Los campos se dibujan siempre (ocultos si el tipo no está marcado) para que la fila no cambie de alto. */}
                    <div className="tipo-campos" style={{ visibility: tipo in b.types ? "visible" : "hidden" }}>
                      <label className="check">Cant.
                        <input type="number" min="1" max="10" aria-label={`Cantidad ${nombre}`} disabled={!(tipo in b.types)}
                               value={b.types[tipo]?.cantidad ?? 1}
                               onChange={(e) => cambiar(b.key, { types: { ...b.types, [tipo]: { ...b.types[tipo], cantidad: Number(e.target.value) } } })} />
                      </label>
                      <label className="check">Min c/u
                        <input type="number" min="1" aria-label={`Minutos ${nombre}`} disabled={!(tipo in b.types)}
                               value={b.types[tipo]?.minutos ?? MINUTOS_POR_TIPO[tipo] ?? 10}
                               onChange={(e) => cambiar(b.key, { types: { ...b.types, [tipo]: { ...b.types[tipo], minutos: Number(e.target.value) } } })} />
                      </label>
                    </div>
                  </div>
                ))}
              </fieldset>
            </div>
          )}
        </div>
        );
      })}
      {boxes.length === 0 && <p className="suave">Añade al menos una skill, o elige un rol SFIA.</p>}
    </section>
  );
}
