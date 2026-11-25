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
  latest_version?: number; // la versión más reciente del ítem (si se pidió una versión concreta puede ser mayor que `version`)
  content: Record<string, any>; // depende del tipo de ítem
  rubric: RubricCriterion[] | null;
  score: { average: number | null; count: number };
  my_score: number | null;
  is_mine: boolean; // el ítem es del usuario (si no, editarlo crea una copia propia)
  source_item_id: string | null; // si es una copia, el ítem original
}

/** Una versión del historial de un ítem. */
export interface ItemVersionInfo {
  id: string;
  version: number;
  origin: string; // generated | regenerated | edited
  created_at: string;
  average: number | null;
  count: number;
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

// ---------- Constructor de evaluaciones (Portal Docente) ----------

/** Una skill de una evaluación o plantilla, con sus niveles en la prueba y los que SFIA define para la skill. */
export interface EvaluationSkill {
  id: string;
  code: string;
  name: string;
  category: string | null;
  min_level: number;
  max_level: number;
  sfia_min_level: number;
  sfia_max_level: number;
  items_count: number;
}

export interface EvaluationSummary {
  id: string;
  name: string;
  status: "draft" | "published" | "discarded";
  created_at: string;
  published_at: string | null;
  duration_minutes: number | null;
  recommended_minutes: number;
  items_count: number;
  skills_count: number;
}

export interface EvaluationDetail extends Omit<EvaluationSummary, "items_count" | "skills_count"> {
  share_token: string | null;
  role_profile: { id: string; name: string } | null;
  role_customized: boolean;
  skills: EvaluationSkill[];
  items: EvaluationItem[];
}

/** Un ítem dentro de una evaluación: fijado a una versión concreta del ítem del banco. */
export interface EvaluationItem {
  position: number;
  item_id: string;
  item_version_id: string;
  version: number;
  skill_id: string;
  skill_code: string;
  type: string;
  level: number;
  estimated_minutes: number;
  statement: string;
  item_active: boolean;
  item_public: boolean;
  is_mine: boolean;
}

/** Un ítem del banco que se puede agregar a la evaluación (versión vigente), con las marcas respecto de ella. */
export interface AvailableItem {
  id: string;
  version_id: string;
  skill_id: string;
  skill_code: string;
  skill_name: string;
  category: string | null;
  type: string;
  level: number;
  estimated_minutes: number;
  statement: string;
  available_to_experts: boolean;
  is_mine: boolean;
  average_score: number | null;
  scores_count: number;
  skill_in_evaluation: boolean;
  level_in_range: boolean | null; // null = su skill no está en la evaluación
  already_added: boolean;
}

export interface TemplateSummary {
  id: string;
  name: string;
  visibility: "private" | "public";
  mine: boolean;
  owner_name: string | null;
  available: boolean;
  blocked_items: { skill_code: string; item_id: string; reason: string }[] | null;
  skills_count: number;
  items_count: number;
  duration_minutes: number | null;
}

export interface CustomRoleSummary { id: string; name: string; skills_count: number }

export interface CustomRoleDetail {
  id: string;
  name: string;
  skills: { id: string; code: string; name: string; category: string | null; min_level: number; max_level: number }[];
}
