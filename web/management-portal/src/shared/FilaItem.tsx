"use client";

// Fila estándar de un ítem (banco, constructor y evaluación): tipo con su icono, skill con el color de su grupo, nivel
// en cuadrito, tiempo y, a la derecha, la puntuación. Pulsarla abre el detalle del ítem (con el teclado, el botón es su primera línea).
import type { KeyboardEvent, ReactNode } from "react";
import { colorDe } from "./categorias";
import { IconoTipo } from "./IconoTipo";
import { Puntuacion } from "./ItemDetail";
import { NivelChip } from "./Niveles";

export interface DatosFila {
  type: string;
  skill_code: string;
  category: string | null;
  level: number;
  estimated_minutes: number;
  statement: string;
  privado?: boolean;
  inactivo?: boolean;
  average_score?: number | null;
  scores_count?: number;
}

interface Props {
  d: DatosFila;
  activa?: boolean;
  /** El ítem ya está en la evaluación: la fila se ve más oscura. */
  agregada?: boolean;
  alPulsar?: () => void;
  /** Antes del contenido (por ejemplo, el asa para ordenar y el número de orden). */
  inicio?: ReactNode;
  /** A la derecha de la puntuación (por ejemplo, los botones de agregar o quitar). */
  acciones?: ReactNode;
  /** Etiquetas extra junto al tiempo (por ejemplo, «ya agregado»). */
  etiquetas?: ReactNode;
}

export function FilaItem({ d, activa = false, agregada = false, alPulsar, inicio, acciones, etiquetas }: Props) {
  const teclado = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alPulsar?.(); }
  };
  return (
    <div className={`fila-item ${activa ? "activa" : ""} ${agregada ? "agregada" : ""} ${alPulsar ? "clicable" : ""}`} onClick={alPulsar}>
      {inicio}
      <div className="fila-item-columna">
        {/* Primera línea: lo que identifica al ítem a la izquierda y, a la derecha, su puntuación y sus acciones. */}
        <div className="fila-item-linea">
          <span className="fila-item-datos" role={alPulsar ? "button" : undefined} tabIndex={alPulsar ? 0 : undefined} onKeyDown={alPulsar ? teclado : undefined}>
            <IconoTipo tipo={d.type} />
            <strong style={{ color: colorDe(d.category) }}>{d.skill_code}</strong>
            <NivelChip nivel={d.level} color={colorDe(d.category)} />
            <span className="suave" title="Tiempo estimado que toma resolver el ítem">{d.estimated_minutes} min</span>
            {d.privado && <span className="etiqueta" title="Solo tú ves este ítem: los validadores no">Privado</span>}
            {d.inactivo && <span className="etiqueta" title="No se ofrece para armar evaluaciones ni a los validadores">Inactivo</span>}
            {etiquetas}
          </span>
          <div className="fila-item-lado" onClick={(e) => e.stopPropagation()}>
            {d.scores_count !== undefined && <Puntuacion promedio={d.average_score ?? null} cantidad={d.scores_count} />}
            {acciones}
          </div>
        </div>
        <span className="enunciado">{d.statement}</span>
      </div>
    </div>
  );
}
