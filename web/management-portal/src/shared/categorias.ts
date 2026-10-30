// Categorías SFIA y sus colores (los de la Figura 2), más el agrupado categoría → subcategoría → skills.
import type { Skill } from "../shared/types";

export const SIN_CATEGORIA = "Sin categoría";
export const SIN_SUBCATEGORIA = "General";

export const COLOR_CATEGORIA: Record<string, string> = {
  "Strategy and architecture": "#b22222",
  "Change and transformation": "#9400d3",
  "Development and implementation": "#b8860b",
  "People and skills": "#191970",
  "Delivery and operation": "#8b4513",
  "Relationships and engagement": "#006400",
  [SIN_CATEGORIA]: "#5b6168",
};

export const colorDe = (categoria: string | null) => COLOR_CATEGORIA[categoria ?? SIN_CATEGORIA] ?? COLOR_CATEGORIA[SIN_CATEGORIA];

export interface GrupoCategoria { categoria: string; color: string; subcategorias: { nombre: string; skills: Skill[] }[]; total: number }

/** Agrupa las skills por categoría y subcategoría, en el orden de COLOR_CATEGORIA y luego alfabético. */
export function agruparSkills(skills: Skill[]): GrupoCategoria[] {
  const mapa = new Map<string, Map<string, Skill[]>>();
  for (const s of skills) {
    const cat = s.category || SIN_CATEGORIA, sub = s.subcategory || SIN_SUBCATEGORIA;
    if (!mapa.has(cat)) mapa.set(cat, new Map());
    const subs = mapa.get(cat)!;
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub)!.push(s);
  }
  const orden = Object.keys(COLOR_CATEGORIA);
  return [...mapa.entries()]
    .sort(([a], [b]) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99) || a.localeCompare(b))
    .map(([categoria, subs]) => ({
      categoria, color: colorDe(categoria),
      subcategorias: [...subs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([nombre, lista]) => ({ nombre, skills: lista })),
      total: [...subs.values()].reduce((n, l) => n + l.length, 0),
    }));
}
