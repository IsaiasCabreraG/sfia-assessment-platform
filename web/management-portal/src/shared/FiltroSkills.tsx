"use client";

// Filtro por varias skills: las elegidas se acumulan como burbujas que se pueden quitar. Se añaden de una en una o desde
// un rol SFIA (`perfiles` y `cargarPerfil` activan ese botón).
import { RolPicker } from "../docente/RolPicker";
import type { Portal } from "./auth";
import { colorDe } from "./categorias";
import { Icono } from "./Estrellas";
import { SkillPicker } from "./SkillPicker";
import type { RoleProfile, RoleProfileDetail, Skill } from "./types";

interface Props {
  /** Skills que se pueden elegir. */
  skills: Skill[];
  seleccion: string[];
  alCambiar: (ids: string[]) => void;
  perfiles?: RoleProfile[];
  cargarPerfil?: (id: string) => Promise<RoleProfileDetail>;
  portal?: Portal;
}

export function FiltroSkills({ skills, seleccion, alCambiar, perfiles, cargarPerfil, portal = "docente" }: Props) {
  const porId = new Map(skills.map((s) => [s.id, s]));
  const agregar = (ids: string[]) => alCambiar([...seleccion, ...ids.filter((id) => !seleccion.includes(id))]);
  return (
    <div className="filtro-skills">
      <span>Skills</span>
      <div className="acciones">
        <SkillPicker skills={skills} alElegir={(id) => agregar([id])} portal={portal} />
        {perfiles && cargarPerfil && (
          <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={cargarPerfil} yaEnFormulario={new Set(seleccion)}
                     alAgregar={(lista) => agregar(lista.map((s) => s.id))} />
        )}
        {seleccion.map((id) => {
          const s = porId.get(id);
          return (
            <span key={id} className="skill-codigo burbuja" style={{ background: colorDe(s?.category ?? null) }} title={s?.name}>
              {s?.code ?? "…"}
              <button type="button" className="chip-quitar" aria-label={`Quitar ${s?.code ?? "la skill"}`}
                      onClick={() => alCambiar(seleccion.filter((x) => x !== id))}><Icono nombre="cerrar" /></button>
            </span>
          );
        })}
        {seleccion.length === 0 && <span className="suave">Todas</span>}
      </div>
    </div>
  );
}
