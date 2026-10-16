export type Revision = "pendiente" | "aprobada" | "rechazada";

export type Item = {
  id: string;
  enunciado: string;
  skill: string;
  nivel: number;
  tipo: string;
  dificultad: string;
  tiempo_min: number;
  rubrica: string[];
  criterios_aceptacion: string[];
  revision: Revision;
  motivo_rechazo: string | null;
};

export type ItemDetalle = Item & {
  skill_info: { codigo: string; nombre: string; descripcion: string };
  nivel_info: { nivel: number; nombre: string; descripcion: string };
};
