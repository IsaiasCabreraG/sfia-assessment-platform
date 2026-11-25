// Atributos completos de un ítem (HU-08): skill, nivel, tiempo y su puntuación (HU-25), con el contenido en la misma vista
// que los borradores (VistaItem): lo que verá quien rinda y lo que solo ve el docente/reclutador.
import type { ItemDetailData } from "./types";
import { Estrellas, Icono } from "./Estrellas";
import { VistaItem } from "./VistaItem";

export const NOMBRE_TIPO: Record<string, string> = {
  single_choice: "Alternativa única",
  true_false: "Verdadero o falso",
  open_question: "Pregunta de desarrollo",
  coding: "Coding challenge",
  system_design: "System design",
  debugging: "Debugging",
};

export function Puntuacion({ promedio, cantidad }: { promedio: number | null; cantidad: number }) {
  // Sin puntuaciones se muestra una estrella tachada (distinto de un promedio, que se muestra en estrellas).
  if (cantidad === 0 || promedio === null)
    return <span className="etiqueta"><Icono nombre="estrella-tachada" titulo="Sin puntuar" /></span>;
  return (
    <span className="etiqueta puntuado">
      <Estrellas valor={Number(promedio)} /> {Number(promedio).toFixed(1)} ({cantidad} {cantidad === 1 ? "puntuación" : "puntuaciones"})
    </span>
  );
}

export function ItemDetail({ item }: { item: ItemDetailData }) {
  return (
    <article className="detalle">
      <header>
        <div className="fila-titulo">
          <h3>
            {item.skill.code} · {item.skill.name}
          </h3>
          <Puntuacion promedio={item.score.average} cantidad={item.score.count} />
        </div>
        <p className="suave">
          {NOMBRE_TIPO[item.type] ?? item.type} · nivel {item.level} · {item.estimated_minutes} min · versión{" "}
          {item.version} · {item.status === "active" ? "activo" : "inactivo"} ·{" "}
          {item.available_to_experts ? "disponible para expertos" : "uso privado"}
        </p>
      </header>
      <VistaItem type={item.type} c={{ statement: item.statement, evaluation_goal: item.evaluation_goal, ...item.content, rubric: item.rubric }} />
    </article>
  );
}
