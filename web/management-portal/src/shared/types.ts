// Formas de los datos que devuelve el backend (solo los campos que usan los portales).

export interface Skill {
  id: string;
  code: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  min_level: number;
  max_level: number;
  description?: string;
}

export interface Level {
  level: number;
  description: string;
}

export interface RoleProfile {
  id: string;
  name: string;
  family: string | null;
  skills_count: number;
}

export interface RoleProfileDetail extends RoleProfile {
  skills: { id: string; code: string; name: string; min_level: number; max_level: number; is_primary: boolean }[];
}

export interface ItemType {
  type: string;
  label: string;
  open: boolean;
}

export interface ItemSummary {
  id: string;
  status: "active" | "inactive";
  available_to_experts: boolean;
  skill_code: string;
  skill_name: string;
  version: number;
  type: string;
  level: number;
  estimated_minutes: number;
  statement: string;
  average_score: number | null; // null = sin puntuar (se muestra como estrella tachada)
  scores_count: number;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  levels: { score: number; descriptor: string }[];
}

export interface ItemDetailData {
  id: string;
  status: "active" | "inactive";
  available_to_experts: boolean;
  skill: { id: string; code: string; name: string };
  version: number;
  origin: string;
  type: string;
  level: number;
  estimated_minutes: number;
  evaluation_goal: string;
  statement: string;
  content: Record<string, any>; // depende del tipo de ítem
  rubric: RubricCriterion[] | null;
  score: { average: number | null; count: number };
  my_score: number | null;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

// ---------- Generación de ítems (Portal Docente) ----------

/** Recuadro de "Qué evaluar": una skill con los tipos de ítem que se piden, cuántos de cada uno y el tiempo de cada ítem. */
export interface Box {
  key: number;
  skill_id: string;
  level: number;
  types: Record<string, { cantidad: number; minutos: number }>; // tipo -> pedido (solo los tipos seleccionados)
  open: boolean; // expandido o minimizado
  context: string; // contexto de esta skill (empresa, cargo o curso); vacío si no hay
}

/** Borrador devuelto por la IA: vive solo en pantalla hasta que se publica. */
export interface Draft {
  id: string;
  skill_id: string;
  skill_label: string;
  skill_color?: string; // color de la categoría SFIA de la skill (nivel y tipo se ven con color)
  level: number;
  item_type: string;
  minutes: number;
  context: string; // contexto con que se generó (se reutiliza al regenerar y al publicar)
  content: Record<string, any>;
  discarded: boolean;
}
