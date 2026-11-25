"use client";

// Paso 2 del constructor: elegir los ítems de la evaluación (HU-11). A la izquierda el banco, que por defecto solo
// ofrece lo que cumple las reglas (skills y niveles de cada una) pero admite filtros libres; a la derecha, los ítems de
// la evaluación, que se ordenan arrastrándolos. Agregar un ítem de una skill nueva o fuera del rango de su skill pide
// confirmación y, al aceptar, ajusta las reglas en la misma operación. Cada cambio se guarda en el borrador.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useState } from "react";
import { api, consulta } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { IconoTipo } from "../shared/IconoTipo";
import { NOMBRE_TIPO, Puntuacion } from "../shared/ItemDetail";
import { SkillPicker } from "../shared/SkillPicker";
import type { AvailableItem, EvaluationDetail, EvaluationItem, Skill } from "../shared/types";
import { FichaItem } from "./FichaItem";
import { Ventana } from "./Ventana";

const LIMITE = 20;
type Pendiente =
  | { tipo: "skill"; item: AvailableItem; lo: number; hi: number }
  | { tipo: "rango"; item: AvailableItem; lo: number; hi: number; actual: [number, number] };

function FilaItem({ it, indice, rango, alVer, alQuitar }: {
  it: EvaluationItem; indice: number; rango: [number, number] | null; alVer: () => void; alQuitar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.item_version_id });
  const estilo = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={estilo} className="fila-eval">
      <button type="button" className="asa" aria-label={`Mover el ítem ${indice + 1}`} {...attributes} {...listeners}>↕</button>
      <b>{indice + 1}</b>
      <div className="fila-eval-datos">
        <span><IconoTipo tipo={it.type} /> <strong>{it.skill_code}</strong>{" "}
          <span className="etiqueta">{rango ? `n${it.level} de ${rango[0]}–${rango[1]}` : `n${it.level}`}</span>
          <span className="etiqueta">{it.estimated_minutes} min</span>
          {it.version > 1 && <span className="etiqueta">versión {it.version}</span>}
        </span>
        <span className="enunciado">{it.statement}</span>
      </div>
      <button type="button" onClick={alVer}>Rúbrica</button>
      <button type="button" className="peligro" onClick={alQuitar}>Quitar</button>
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
  const [filtros, setFiltros] = useState({ reglas: true, skill_id: "", min_level: "", max_level: "", item_type: "" });
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<{ total: number; items: AvailableItem[] }>({ total: 0, items: [] });
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [ficha, setFicha] = useState<{ itemId: string; version?: number } | null>(null);
  const [error, setError] = useState("");

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { api<Skill[]>("docente", `${CATALOG_URL}/skills`).then(setCatalogo).catch((e) => setError(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => { setQ(texto); setPagina(0); }, 300); return () => clearTimeout(t); }, [texto]);

  const cargar = useCallback(() => {
    api<{ total: number; items: AvailableItem[] }>("docente", `${BUILDER_URL}/available-items${consulta({
      evaluation_id: detalle.id, only_rules: filtros.reglas ? "true" : "", skill_ids: filtros.skill_id,
      min_level: filtros.reglas ? "" : filtros.min_level, max_level: filtros.reglas ? "" : filtros.max_level,
      item_type: filtros.item_type, q, limit: LIMITE, offset: pagina * LIMITE })}`)
      .then((r) => { setLista(r); setError(""); })
      .catch((e) => setError(e.message));
  }, [detalle, filtros, q, pagina]);
  useEffect(cargar, [cargar]);

  const porId = new Map(catalogo.map((s) => [s.id, s]));
  const versionesEnEvaluacion = new Set(detalle.items.map((i) => i.item_version_id));
  const itemsEnEvaluacion = new Set(detalle.items.map((i) => i.item_id));
  const rangos = detalle.skills.map((s) => ({ skill_id: s.id, min_level: s.min_level, max_level: s.max_level }));
  const rangoDe = (skillId: string): [number, number] | null => {
    const s = detalle.skills.find((x) => x.id === skillId);
    return s ? [s.min_level, s.max_level] : null;
  };
  const cambiar = (campo: string, valor: string | boolean) => { setFiltros({ ...filtros, [campo]: valor }); setPagina(0); };

  /** Guarda en el borrador el orden de los ítems (y, si hace falta, las skills con sus niveles). */
  const guardarItems = async (ids: string[], skills?: typeof rangos) => {
    try {
      const d = await api<EvaluationDetail>("docente", `${BUILDER_URL}/evaluations/${detalle.id}`, {
        method: "PUT", body: { item_version_ids: ids, ...(skills ? { skills } : {}) } });
      alCambio(d); setError("");
    } catch (e) { setError((e as Error).message); cargar(); }
  };
  const idsActuales = detalle.items.map((i) => i.item_version_id);

  const intentar = (it: AvailableItem) => {
    const sfia = porId.get(it.skill_id);
    if (!it.skill_in_evaluation)
      setPendiente({ tipo: "skill", item: it, lo: Math.min(sfia?.min_level ?? it.level, it.level), hi: Math.max(sfia?.max_level ?? it.level, it.level) });
    else if (it.level_in_range === false) {
      const [lo, hi] = rangoDe(it.skill_id)!;
      setPendiente({ tipo: "rango", item: it, lo: Math.min(lo, it.level), hi: Math.max(hi, it.level), actual: [lo, hi] });
    } else guardarItems([...idsActuales, it.version_id]);
  };

  const confirmar = () => {
    if (!pendiente) return;
    const { item, lo, hi } = pendiente;
    const skills = pendiente.tipo === "skill"
      ? [...rangos, { skill_id: item.skill_id, min_level: lo, max_level: hi }]
      : rangos.map((r) => (r.skill_id === item.skill_id ? { ...r, min_level: lo, max_level: hi } : r));
    setPendiente(null);
    guardarItems([...idsActuales, item.version_id], skills);
  };

  const alSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = idsActuales.indexOf(String(e.active.id)), a = idsActuales.indexOf(String(e.over.id));
    const orden = arrayMove(detalle.items, de, a).map((i, n) => ({ ...i, position: n + 1 }));
    alCambio({ ...detalle, items: orden });  // se ve el nuevo orden al instante; luego se guarda
    guardarItems(orden.map((i) => i.item_version_id));
  };

  const verFicha = (itemId: string, version?: number) => setFicha({ itemId, version });

  const skillFiltrada = porId.get(filtros.skill_id);
  return (
    <div>
      <div className="dos-columnas" style={{ gridTemplateColumns: "minmax(320px, 1.25fr) minmax(300px, 1fr)" }}>
        <section className="panel">
          <h3 style={{ margin: "0 0 .5rem" }}>Banco de ítems</h3>
          <label className="check" style={{ marginBottom: ".5rem" }}>
            <input type="checkbox" checked={filtros.reglas} onChange={(e) => cambiar("reglas", e.target.checked)} />
            Solo ítems que cumplen las reglas
          </label>
          <div className="filtros">
            <div className="campo-filtro"><span>Skill</span>
              <SkillPicker skills={catalogo} alElegir={(id) => cambiar("skill_id", id)} alLimpiar={() => cambiar("skill_id", "")}
                           texto={skillFiltrada ? `${skillFiltrada.code} ▾` : "Todas ▾"} />
            </div>
            <label>Nivel mínimo
              <select value={filtros.min_level} disabled={filtros.reglas} onChange={(e) => cambiar("min_level", e.target.value)}>
                <option value="">{filtros.reglas ? "según cada skill" : "Todos"}</option>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>Nivel máximo
              <select value={filtros.max_level} disabled={filtros.reglas} onChange={(e) => cambiar("max_level", e.target.value)}>
                <option value="">{filtros.reglas ? "según cada skill" : "Todos"}</option>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>Tipo
              <select value={filtros.item_type} onChange={(e) => cambiar("item_type", e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(NOMBRE_TIPO).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
              </select>
            </label>
            <label>Texto
              <input type="search" aria-label="Buscar ítems" placeholder="buscar…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <p className="suave">{lista.total} ítem(s)</p>
          {lista.items.map((i) => {
            const agregado = versionesEnEvaluacion.has(i.version_id);
            return (
              <div key={i.id} className="fila-banco">
                <div className="fila-eval-datos">
                  <span><IconoTipo tipo={i.type} />{" "}
                    <strong style={{ color: colorDe(i.category) }}>{i.skill_code}</strong>{" "}
                    <span className="etiqueta">nivel {i.level}</span>
                    <span className="etiqueta">{i.estimated_minutes} min</span>
                    {!i.skill_in_evaluation && <span className="etiqueta aviso-et">skill nueva</span>}
                    {i.level_in_range === true && <span className="etiqueta ok-et">en rango</span>}
                    {i.level_in_range === false && <span className="etiqueta aviso-et">fuera de rango</span>}
                    <span className={`etiqueta ${i.available_to_experts ? "publico" : ""}`}>{i.is_mine ? (i.available_to_experts ? "mío · público" : "mío · privado") : "público"}</span>
                    {agregado && <span className="etiqueta ok-et">ya agregado</span>}
                    {!agregado && itemsEnEvaluacion.has(i.id) && <span className="etiqueta">otra versión agregada</span>}
                    <Puntuacion promedio={i.average_score} cantidad={i.scores_count} />
                  </span>
                  <span className="enunciado">{i.statement}</span>
                </div>
                <button type="button" onClick={() => verFicha(i.id)}>Ver</button>
                <button type="button" className="primario" disabled={agregado} onClick={() => intentar(i)}>{agregado ? "Agregado" : "Agregar"}</button>
              </div>
            );
          })}
          <div className="paginacion">
            <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina + 1}</span>
            <button disabled={(pagina + 1) * LIMITE >= lista.total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        </section>

        <section className="panel">
          <h3 style={{ margin: "0 0 .3rem" }}>Evaluación ({detalle.items.length} ítem{detalle.items.length === 1 ? "" : "s"})</h3>
          <p className="suave" style={{ margin: "0 0 .5rem" }}>Arrastra ↕ para ordenar (con el teclado: enfoca ↕, pulsa Espacio y las flechas).</p>
          {detalle.items.length === 0 && <p className="suave">Todavía no hay ítems. Agrégalos desde el banco.</p>}
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext items={idsActuales} strategy={verticalListSortingStrategy}>
              {detalle.items.map((it, n) => (
                <FilaItem key={it.item_version_id} it={it} indice={n} rango={rangoDe(it.skill_id)}
                          alVer={() => verFicha(it.item_id, it.version)}
                          alQuitar={() => guardarItems(idsActuales.filter((x) => x !== it.item_version_id))} />
              ))}
            </SortableContext>
          </DndContext>
          <p style={{ margin: ".7rem 0 0" }}><strong>{detalle.recommended_minutes} min</strong> recomendados <span className="suave">(suma de los ítems)</span></p>
          {detalle.duration_minutes != null && detalle.duration_minutes !== detalle.recommended_minutes && (
            <p className="suave" style={{ margin: 0 }}>Duración fijada en las reglas: {detalle.duration_minutes} min.</p>
          )}
        </section>
      </div>
      <div className="acciones" style={{ justifyContent: "space-between", marginTop: ".8rem" }}>
        <button onClick={alVolver}>← Reglas</button>
        <button className="primario" onClick={alSiguiente}>Siguiente: publicación →</button>
      </div>

      {pendiente && (
        <Ventana titulo={pendiente.tipo === "skill" ? "Agregar una skill nueva" : "Ítem fuera del rango de la skill"} alCerrar={() => setPendiente(null)}>
          {pendiente.tipo === "skill" ? (
            <>
              <p>El ítem es de <strong>{pendiente.item.skill_code}</strong>, que no está en la evaluación.</p>
              <p className="suave">¿Añadir {pendiente.item.skill_code} a la evaluación (con los niveles {pendiente.lo} a {pendiente.hi}) y agregar el ítem?</p>
            </>
          ) : (
            <>
              <p>El ítem es de <strong>{pendiente.item.skill_code} nivel {pendiente.item.level}</strong> y en esta evaluación {pendiente.item.skill_code} admite los niveles <strong>{pendiente.actual[0]} a {pendiente.actual[1]}</strong>.</p>
              <p className="suave">¿Ampliar {pendiente.item.skill_code} a los niveles {pendiente.lo}–{pendiente.hi} y agregar el ítem?</p>
            </>
          )}
          <div className="acciones" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setPendiente(null)}>Cancelar</button>
            <button className="primario" onClick={confirmar}>{pendiente.tipo === "skill" ? "Añadir skill y agregar" : `Ampliar ${pendiente.item.skill_code} y agregar`}</button>
          </div>
        </Ventana>
      )}

      {ficha && <FichaItem itemId={ficha.itemId} version={ficha.version} alCerrar={() => setFicha(null)} />}
    </div>
  );
}
