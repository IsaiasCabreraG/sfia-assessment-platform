// Atributos completos de un ítem (HU-08): skill, nivel, tiempo y su puntuación (HU-25), con el contenido en la misma vista
// que los borradores (VistaItem): lo que verá quien rinda y lo que solo ve el docente/reclutador.
import type { ItemDetailData } from "./types";
import { Estrellas, Icono } from "./Estrellas";
import { colorDe } from "./categorias";
import { NOMBRE_TIPO } from "./tipos";
import { IconoTipo } from "./IconoTipo";
import { NivelChip } from "./Niveles";
import { VistaItem } from "./VistaItem";

export { NOMBRE_TIPO };

export function Puntuacion({ promedio, cantidad }: { promedio: number | null; cantidad: number }) {
  // Sin puntuaciones se muestra una estrella tachada (distinto de un promedio, que se muestra en estrellas).
  if (cantidad === 0 || promedio === null)
    return <span className="etiqueta" title="Sin puntuar: ningún validador ha puntuado este ítem todavía"><Icono nombre="estrella-tachada" /></span>;
  return (
    <span className="etiqueta puntuado">
      <Estrellas valor={Number(promedio)} /> {Number(promedio).toFixed(1)} ({cantidad} {cantidad === 1 ? "puntuación" : "puntuaciones"})
    </span>
  );
}

export function ItemDetail({ item, categoria }: { item: ItemDetailData; categoria?: string | null }) {
  return (
    <article className="detalle">
      <header>
        <div className="fila-titulo">
          <h3 className="titulo-ficha">
            <span style={{ color: colorDe(categoria ?? null) }}>{item.skill.code}</span>
            <NivelChip nivel={item.level} color={colorDe(categoria ?? null)} />
            <span>{item.skill.name}</span>
          </h3>
          <Puntuacion promedio={item.score.average} cantidad={item.score.count} />
        </div>
        <p className="ficha-meta">
          <span className="dato" title={`Tipo de ítem: ${NOMBRE_TIPO[item.type] ?? item.type}`}><IconoTipo tipo={item.type} decorativo /> {NOMBRE_TIPO[item.type] ?? item.type}</span>
          <span className="dato" title="Tiempo estimado que toma resolver el ítem">{item.estimated_minutes} min</span>
          <span className="dato" title={`Versión ${item.version}: cada vez que se edita o se regenera el ítem se guarda una versión nueva; las evaluaciones publicadas conservan la que tenían.`}>versión {item.version}</span>
          {item.source_item_id && <span className="dato" title="Este ítem se creó al editar un ítem de otro docente">copia de otro ítem</span>}
          {item.status === "inactive" && <span className="etiqueta" title="Un ítem inactivo no se ofrece para armar evaluaciones ni a los validadores; las evaluaciones ya publicadas conservan su versión.">Inactivo</span>}
          <span className="etiqueta" title={item.available_to_experts ? "Los validadores pueden ver y puntuar este ítem" : "Solo tú ves este ítem: los validadores no"}>
            {item.available_to_experts ? "Disponible para expertos" : "Privado"}
          </span>
        </p>
      </header>
      <VistaItem type={item.type} c={{ statement: item.statement, evaluation_goal: item.evaluation_goal, ...item.content, rubric: item.rubric }} />
    </article>
  );
}
