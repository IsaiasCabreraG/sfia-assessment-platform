// Los criterios fijos vienen del mismo archivo que lee el backend (content/generation/rubric.py).
import criteriosFijos from "../../../../config/criterios-fijos.json";

// Tipos de ítem con rúbrica (los abiertos), igual que en el backend (content/types.py).
export const OPEN_TYPES = new Set(["open_question", "system_design", "debugging"]);

export interface CriterioRubrica {
  name: string;
  weight: number;
  levels: { score: number; descriptor: string }[];
}

// Criterios fijos de la rúbrica de cada tipo abierto, con sus 4 descriptores (config/criterios-fijos.json).
const { descripcion: _descripcion, ...fijos } = criteriosFijos;
export const CRITERIOS_FIJOS: Record<string, CriterioRubrica[]> = fijos;

// Explicaciones con un ejemplo para los tooltips "i" del formulario de generación (HU-06-2).
export const DESCRIPCION_TIPO: Record<string, string> = {
  single_choice: "Pregunta con varias alternativas y una sola correcta. Ej.: ¿Qué patrón desacopla la creación de objetos de su uso?",
  true_false: "Afirmación que se responde como verdadera o falsa. Ej.: «Un índice siempre acelera las escrituras».",
  open_question: "Pregunta abierta que se responde con texto y se evalúa con una rúbrica. Ej.: explica la diferencia entre una prueba unitaria y una de integración.",
  coding: "El postulante escribe código que se valida con tests unitarios. Ej.: una función que invierte una lista enlazada.",
  system_design: "Diseño de un sistema a partir de requisitos, evaluado con una rúbrica. Ej.: diseña un acortador de URLs.",
  debugging: "Código con un defecto conocido que el postulante debe encontrar y corregir. Ej.: un índice fuera de rango al recorrer una lista.",
};
export const TEXTO_CANTIDAD = "Cuántos ítems de este tipo se piden para esta skill (de 1 a 10). Ej.: 3 preguntas de alternativa única.";
export const TEXTO_MINUTOS = "Tiempo estimado, en minutos, que tendrá quien rinda para resolver cada ítem de este tipo. Ej.: 2 para una alternativa única y 25 para un coding challenge.";
