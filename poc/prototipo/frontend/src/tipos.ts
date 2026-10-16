export type Skill = { codigo: string; nombre: string };
// Los roles guardados por el usuario (propio) incluyen además la configuración de cada recuadro.
export type SkillDeRol = {
  codigo: string; nivel: number;
  tipos?: { tipo: TipoId; cantidad: number }[]; dificultad?: "basica" | "media" | "alta"; tiempo_min?: number;
};
export type Rol = { id: string; nombre: string; propio?: boolean; skills: SkillDeRol[] };
export type Catalogo = { skills: Skill[]; roles: Rol[]; niveles: Record<string, string> };

export type Archivo = { nombre: string; contenido: string };
export type SkillElegida = { codigo: string; nombre: string; nivel: number };

export const TIPOS = {
  pregunta: "Pregunta de alternativas",
  coding: "Coding challenge",
  system_design: "System design",
  debugging: "Debugging / code review",
  proyecto: "Proyecto práctico",
} as const;
export type TipoId = keyof typeof TIPOS;

// Un recuadro del paso 1: una skill con su nivel y lo que se pide de ella.
export type Bloque = {
  uid: string;
  codigo: string;
  nombre: string;
  nivel: number;
  tipos: { tipo: TipoId; cantidad: number }[];
  dificultad: "basica" | "media" | "alta";
  tiempo_min: number;
  abierto: boolean; // solo de interfaz (expandido o minimizado)
};

export type Formulario = {
  rol: string;
  bloques: Bloque[];
  contexto: { texto: string; archivos: Archivo[] };
  cargo: { texto: string; archivos: Archivo[] };
  stack: string[];
  referencias: Archivo[];
  restricciones: string;
};

export type Borrador = {
  id: string;
  enunciado: string;
  skill: string;
  nivel: number;
  tipo: string;
  dificultad: string;
  rubrica: string[];
  criterios_aceptacion: string[];
  tiempo_min: number;
  estado: "draft" | "descartado";
};

export const formularioInicial: Formulario = {
  rol: "",
  bloques: [],
  contexto: { texto: "", archivos: [] },
  cargo: { texto: "", archivos: [] },
  stack: [],
  referencias: [],
  restricciones: "",
};

let contador = 0;
export function nuevoBloque(codigo: string, nombre: string, nivel: number, abierto: boolean): Bloque {
  return {
    uid: `bl${++contador}`, codigo, nombre, nivel, abierto,
    tipos: [{ tipo: "pregunta", cantidad: 2 }], dificultad: "media", tiempo_min: 20,
  };
}

export const resumenBloque = (b: Bloque) =>
  `${b.tipos.map((t) => `${t.cantidad} ${TIPOS[t.tipo]}`).join(", ") || "sin tipos"} · ${b.dificultad} · ${b.tiempo_min} min`;
