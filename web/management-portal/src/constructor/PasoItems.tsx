"use client";

// Paso 2 del constructor: elegir los ítems de la evaluación (HU-11). A la izquierda el banco, que solo ofrece lo que
// cumple las reglas (las skills de la evaluación y los niveles de cada una); a la derecha, los ítems de la evaluación,
// que se ordenan arrastrándolos. Cada cambio se guarda en el borrador.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useState } from "react";
import { api } from "../shared/api";
import { BarraFlotante } from "../shared/BarraFlotante";
import { colorDe } from "../shared/categorias";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { Icono } from "../shared/Estrellas";
import { FilaItem } from "../shared/FilaItem";
import { FiltroSkills } from "../shared/FiltroSkills";
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import { Ordenar } from "../shared/Ordenar";
import { Paginacion } from "../shared/Paginacion";
import { useVigencia } from "../shared/useVigencia";
import type { AvailableItem, EvaluationDetail, EvaluationItem, Skill } from "../shared/types";
import { FichaItem } from "./FichaItem";

const LIMITE = 20;
const ORDENES: [string, string][] = [
  ["skill", "Skill y nivel"], ["recent", "Más recientes"], ["score", "Mejor puntuados"],
  ["level_asc", "Nivel (menor a mayor)"], ["level_desc", "Nivel (mayor a menor)"], ["time", "Tiempo (menor a mayor)"],
];

function FilaEvaluacion({ it, indice, categoria, alVer, alQuitar }: {
  it: EvaluationItem; indice: number; categoria: string | null; alVer: () => void; alQuitar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.item_version_id });
  const estilo = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={estilo} className="fila-eval-contenedor">
      <FilaItem alPulsar={alVer}
                d={{ type: it.type, skill_code: it.skill_code, category: categoria, level: it.level, estimated_minutes: it.estimated_minutes, statement: it.statement }}
                inicio={<>
                  <button type="button" className="asa" aria-label={`Mover el ítem ${indice + 1}`} onClick={(e) => e.stopPropagation()} {...attributes} {...listeners}>↕</button>
                  <b>{indice + 1}</b>
                </>}
                acciones={<button type="button" className="icono-btn peligro" aria-label="Quitar de la evaluación" title="Quitar de la evaluación (el ítem sigue en el banco)" onClick={alQuitar}><Icono nombre="menos" /></button>} />
    </div>
  );
}

interface Props {
  detalle: EvaluationDetail;
  alCambio: (d: EvaluationDetail) => void;
  alVolver: () => void;
  alSiguiente: () => void;
}

export function PasoItems({ detalle, alCambio, alVolver, alSiguiente }: Props) {
  const [catalogo, setCatalogo] = useState<Skill[]>([]);
  const [filtros, setFiltros] = useState({ item_type: "", order: "skill" });
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<{ total: number; items: AvailableItem[] }>({ total: 0, items: [] });
  const [ficha, setFicha] = useState<{ itemId: string; version?: number } | null>(null);
  const [error, setError] = useState("");

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { api<Skill[]>("docente", `${CATALOG_URL}/skills`).then(setCatalogo).catch((e) => setError(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => { setQ(texto); setPagina(0); }, 300); return () => clearTimeout(t); }, [texto]);

  const nueva = useVigencia();
  const cargar = useCallback(() => {
    const vigente = nueva();
    const params = new URLSearchParams({ evaluation_id: detalle.id, only_rules: "true", limit: String(LIMITE), offset: String(pagina * LIMITE), order: filtros.order });
    if (filtros.item_type) params.set("item_type", filtros.item_type);
    if (q) params.set("q", q);
    skillIds.forEach((id) => params.append("skill_ids", id));
    api<{ total: number; items: AvailableItem[] }>("docente", `${BUILDER_URL}/available-items?${params.toString()}`)
      .then((r) => { if (vigente()) { setLista(r); setError(""); } })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [detalle, filtros, skillIds, q, pagina, nueva]);
  useEffect(cargar, [cargar]);

  const porId = new Map(catalogo.map((s) => [s.id, s]));
  const versionesEnEvaluacion = new Set(detalle.items.map((i) => i.item_version_id));
  const itemsEnEvaluacion = new Set(detalle.items.map((i) => i.item_id));
  const cambiar = (campo: string, valor: string) => { setFiltros({ ...filtros, [campo]: valor }); setPagina(0); };

  /** Guarda en el borrador el orden de los ítems. */
  const guardarItems = async (ids: string[]) => {
    try {
      const d = await api<EvaluationDetail>("docente", `${BUILDER_URL}/evaluations/${detalle.id}`, { method: "PUT", body: { item_version_ids: ids } });
      alCambio(d); setError("");
    } catch (e) { setError((e as Error).message); cargar(); }
  };
  const idsActuales = detalle.items.map((i) => i.item_version_id);

  const alSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = idsActuales.indexOf(String(e.active.id)), a = idsActuales.indexOf(String(e.over.id));
    const orden = arrayMove(detalle.items, de, a).map((i, n) => ({ ...i, position: n + 1 }));
    alCambio({ ...detalle, items: orden });  // se ve el nuevo orden al instante; luego se guarda
    guardarItems(orden.map((i) => i.item_version_id));
  };

  const skillsDeLaEvaluacion = detalle.skills.map((s) => porId.get(s.id)).filter((s): s is Skill => s !== undefined);
  return (
    <div className="con-barra-flotante">
      <div className="dos-columnas cols-banco">
        <section className="panel">
          <h3 className="mb-5">Banco de ítems</h3>
          <div className="filtros">
            <FiltroSkills skills={skillsDeLaEvaluacion} seleccion={skillIds} alCambiar={(ids) => { setSkillIds(ids); setPagina(0); }} />
            <label>Tipo
              <select value={filtros.item_type} onChange={(e) => cambiar("item_type", e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(NOMBRE_TIPO).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
              </select>
            </label>
            <label>Texto
              <input type="search" aria-label="Buscar ítems" placeholder="buscar…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
            <Ordenar valor={filtros.order} opciones={ORDENES} alCambiar={(v) => cambiar("order", v)} />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="lista-cabecera">
            <span className="suave">{lista.total} ítem(s) que cumplen las reglas</span>
            <Paginacion pagina={pagina} total={lista.total} limite={LIMITE} alCambiar={setPagina} />
          </div>
          {lista.items.map((i) => {
            const agregado = versionesEnEvaluacion.has(i.version_id);
            return (
              <div key={i.id} className="fila-banco-contenedor">
                <FilaItem alPulsar={() => setFicha({ itemId: i.id })} agregada={agregado}
                          d={{ type: i.type, skill_code: i.skill_code, category: i.category, level: i.level, estimated_minutes: i.estimated_minutes,
                               statement: i.statement, privado: !i.available_to_experts, average_score: i.average_score, scores_count: i.scores_count }}
                          etiquetas={!agregado && itemsEnEvaluacion.has(i.id) ? <span className="etiqueta">otra versión agregada</span> : undefined}
                          acciones={agregado
                            ? <button type="button" className="icono-btn peligro" aria-label="Quitar de la evaluación" title="Quitar de la evaluación (el ítem sigue en el banco)"
                                      onClick={() => guardarItems(idsActuales.filter((x) => x !== i.version_id))}><Icono nombre="menos" /></button>
                            : <button type="button" className="icono-btn primario" aria-label="Agregar" title="Agregar a la evaluación"
                                      onClick={() => guardarItems([...idsActuales, i.version_id])}><Icono nombre="mas" /></button>} />
              </div>
            );
          })}
          {lista.total > LIMITE && <Paginacion pagina={pagina} total={lista.total} limite={LIMITE} alCambiar={setPagina} />}
        </section>

        <section className="panel">
          <h3 className="mb-3">Evaluación ({detalle.items.length} ítem{detalle.items.length === 1 ? "" : "s"})</h3>
          <p className="suave mb-5">Arrastra ↕ para ordenar (con el teclado: enfoca ↕, pulsa Espacio y las flechas).</p>
          {detalle.items.length === 0 && <p className="suave">Todavía no hay ítems. Agrégalos desde el banco.</p>}
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={idsActuales} strategy={verticalListSortingStrategy}>
              {detalle.items.map((it, n) => (
                <FilaEvaluacion key={it.item_version_id} it={it} indice={n} categoria={porId.get(it.skill_id)?.category ?? null}
                                alVer={() => setFicha({ itemId: it.item_id, version: it.version })}
                                alQuitar={() => guardarItems(idsActuales.filter((x) => x !== it.item_version_id))} />
              ))}
            </SortableContext>
          </DndContext>
          <p className="mt-7 mb-0"><strong>{detalle.recommended_minutes} min</strong> recomendados <span className="suave">(suma de los ítems)</span></p>
          {detalle.duration_minutes != null && detalle.duration_minutes !== detalle.recommended_minutes && (
            <p className="suave m-0">Duración fijada en las reglas: {detalle.duration_minutes} min.</p>
          )}
        </section>
      </div>
      <BarraFlotante>
        <button className="izquierda" onClick={alVolver}>← Reglas</button>
        <button className="primario" onClick={alSiguiente}>Siguiente: publicación →</button>
      </BarraFlotante>

      {ficha && <FichaItem itemId={ficha.itemId} version={ficha.version} alCerrar={() => { setFicha(null); cargar(); }} />}
    </div>
  );
}
