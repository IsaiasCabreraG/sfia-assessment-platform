"use client";

// Descripción de una skill SFIA (se pide al catálogo la primera vez y se guarda) y ficha con sus niveles.
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Portal } from "./auth";
import { CATALOG_URL } from "./config";
import type { Level, Skill } from "./types";

const nivelesCache = new Map<Portal, Promise<Level[]>>();

/** Descripción genérica de los 7 niveles SFIA (se pide una sola vez). */
export function useNiveles(portal: Portal = "docente"): Level[] {
  const [niveles, setNiveles] = useState<Level[]>([]);
  useEffect(() => {
    let p = nivelesCache.get(portal);
    if (!p) {
      p = api<Level[]>(portal, `${CATALOG_URL}/levels`).catch(() => { nivelesCache.delete(portal); return [] as Level[]; });
      nivelesCache.set(portal, p);
    }
    let vigente = true;
    p.then((n) => { if (vigente) setNiveles(n); });
    return () => { vigente = false; };
  }, [portal]);
  return niveles;
}

const cache = new Map<string, Promise<Partial<Skill>>>();

function skillDe(skillId: string, portal: Portal): Promise<Partial<Skill>> {
  const clave = `${portal}/${skillId}`;
  let p = cache.get(clave);
  if (!p) {
    p = api<Partial<Skill>>(portal, `${CATALOG_URL}/skills/${skillId}`).catch(() => { cache.delete(clave); return {}; });
    cache.set(clave, p);
  }
  return p;
}

/** «1 · Follow»: lo que se ve al pasar el cursor por un nivel de responsabilidad. */
export function titulosDeNiveles(niveles: Level[]): Record<number, string> {
  return Object.fromEntries(niveles.map((n) => [n.level, `Nivel ${n.level} · ${n.description}`]));
}

/** Datos de la skill (su descripción y su categoría), pedidos al catálogo una sola vez. Con `activo` en false no consulta nada. */
export function useDatosSkill(skillId: string | null, activo = true, portal: Portal = "docente"): Partial<Skill> | null {
  const [datos, setDatos] = useState<Partial<Skill> | null>(null);
  useEffect(() => {
    setDatos(null);
    if (!skillId || !activo) return;
    let vigente = true;
    skillDe(skillId, portal).then((d) => { if (vigente) setDatos(d); });
    return () => { vigente = false; };
  }, [skillId, activo, portal]);
  return datos;
}

/** Descripción de la skill (null mientras carga). */
export function useDescripcionSkill(skillId: string | null, activo = true, portal: Portal = "docente"): string | null {
  const d = useDatosSkill(skillId, activo, portal);
  return d === null ? null : d.description ?? "";
}

/** Ficha de una skill: su descripción y qué significa cada nivel en el que está definida. */
export function FichaSkill({ skill, color, activo = true, portal = "docente" }: { skill: Skill; color: string; activo?: boolean; portal?: Portal }) {
  const descripcion = useDescripcionSkill(skill.id, activo, portal);
  const niveles = useNiveles(portal);
  return (
    <div className="ficha-skill">
      <p className="m-0"><strong style={{ color }}>{skill.code}</strong> · {skill.name}</p>
      <p className="suave my-2">{descripcion === null ? "Cargando la descripción…" : descripcion || "Sin descripción."}</p>
      <ul className="ficha-niveles">
        {niveles.filter((n) => n.level >= skill.min_level && n.level <= skill.max_level).map((n) => (
          <li key={n.level}><b>{n.level}</b> {n.description}</li>
        ))}
      </ul>
    </div>
  );
}
