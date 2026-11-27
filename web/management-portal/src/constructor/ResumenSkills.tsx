"use client";

// Resumen de una evaluación: cifras, gráficos (tipo de ítem, nivel y forma de corrección) y las skills con sus niveles.
// Sirve para ver de un vistazo si la prueba está equilibrada antes de publicarla.
import { colorDe } from "../shared/categorias";
import { LineaNiveles, Torta } from "../shared/Graficos";
import { Icono } from "../shared/Estrellas";
import { COLOR_TIPO, IconoTipo } from "../shared/IconoTipo";
import { Niveles } from "../shared/Niveles";
import { NOMBRE_TIPO } from "../shared/tipos";
import type { EvaluationDetail } from "../shared/types";

const ABIERTOS = ["open_question", "coding", "system_design", "debugging"]; // los que no se corrigen solos

interface Props {
  detalle: EvaluationDetail;
  /** Si se pasa, el total de minutos lleva un botón para cambiar la duración. */
  alCambiarDuracion?: () => void;
}

export function ResumenSkills({ detalle, alCambiarDuracion }: Props) {
  const items = detalle.items;
  const total = items.length;
  const duracion = detalle.duration_minutes ?? detalle.recommended_minutes;
  const porTipo = Object.keys(NOMBRE_TIPO).map((tipo) => ({
    etiqueta: NOMBRE_TIPO[tipo], valor: items.filter((i) => i.type === tipo).length, color: COLOR_TIPO[tipo], icono: <IconoTipo tipo={tipo} decorativo />,
  }));
  const porNivel: Record<number, number> = {};
  for (const i of items) porNivel[i.level] = (porNivel[i.level] ?? 0) + 1;
  const manuales = items.filter((i) => ABIERTOS.includes(i.type)).length;
  const conItems = detalle.skills.filter((s) => s.items_count > 0);
  const sinItems = detalle.skills.filter((s) => s.items_count === 0);

  const fila = (s: EvaluationDetail["skills"][number]) => (
    <li key={s.id} className="skill-resumen">
      <span className="skill-codigo" style={{ background: colorDe(s.category) }}>{s.code}</span>
      <span className="skill-resumen-nombre">{s.name}</span>
      <Niveles min={s.min_level} max={s.max_level} color={colorDe(s.category)} />
      <span className="skill-resumen-cantidad">{s.items_count} ítem{s.items_count === 1 ? "" : "s"}</span>
    </li>
  );

  return (
    <div className="resumen-eval">
      <div className="resumen-cifras">
        <div><strong>{total}</strong><span className="suave">ítems</span></div>
        <div><strong>{detalle.skills.length}</strong><span className="suave">skills</span></div>
        <div className="cifra-duracion">
          {alCambiarDuracion && (
            <button type="button" className="icono-btn" onClick={alCambiarDuracion} aria-label="Cambiar la duración" title="Cambiar la duración total">
              <Icono nombre="editar" />
            </button>
          )}
          <span className="cifra-duracion-valor"><strong>{duracion}</strong><span className="suave">min en total</span></span>
        </div>
      </div>
      {detalle.role_profile && (
        <p className="suave m-0">Rol de base: {detalle.role_profile.name}{detalle.role_customized ? " (rol personalizado)" : ""}</p>
      )}

      <div className="graficos">
        <Torta titulo="Por tipo de ítem" porciones={porTipo} />
        <LineaNiveles titulo="Por nivel de responsabilidad" cantidades={porNivel} />
        <Torta titulo="Forma de corrección" porciones={[
          { etiqueta: "Automática", valor: total - manuales, color: "#1f5fbf" },
          { etiqueta: "Con rúbrica", valor: manuales, color: "#b8860b" },
        ]} />
      </div>

      <h4>Skills</h4>
      <ul className="skills-resumen">{conItems.map(fila)}</ul>
      {sinItems.length > 0 && (
        <div className="skills-sin-items">
          <strong>Sin ítems todavía ({sinItems.length})</strong>
          <ul className="skills-resumen">{sinItems.map(fila)}</ul>
        </div>
      )}
    </div>
  );
}
