"use client";

// Banco de ítems: filtros (HU-07), lista ordenable y paginada con puntuación (HU-25) y detalle (HU-08) de un ítem.
// Lo usan los dos portales; `modo` decide qué filtros se ofrecen y `acciones` agrega los botones propios
// de cada portal (activar/desactivar en el docente, puntuar en el validador).
import { useVigencia } from "./useVigencia";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, consulta } from "./api";
import type { Portal } from "./auth";
import { CATALOG_URL, CONTENT_URL } from "./config";
import { FilaItem } from "./FilaItem";
import { FiltroSkills } from "./FiltroSkills";
import { ItemDetail, NOMBRE_TIPO } from "./ItemDetail";
import { NivelesRango } from "./NivelesRango";
import { Ordenar } from "./Ordenar";
import { Paginacion } from "./Paginacion";
import { RangoEstrellas } from "./RangoEstrellas";
import type { ItemDetailData, ItemSummary, RoleProfile, RoleProfileDetail, Skill } from "./types";

interface Props {
  portal: Portal;
  modo: "docente" | "validador";
  /** Botones propios del portal para el ítem abierto; `recargar` actualiza lista y detalle y `barra` es el lugar (arriba a la
   *  derecha del detalle) donde dibujar sus botones con icono, con un portal de React. */
  acciones?: (item: ItemDetailData, recargar: () => void, abrir: (id: string) => void, barra: HTMLElement | null) => ReactNode;
  /** Cambia cuando otra pantalla crea ítems, para volver a consultar la lista. */
  version?: number;
}

const LIMITE = 20;
const ORDENES: [string, string][] = [
  ["recent", "Más recientes"], ["oldest", "Más antiguos"], ["score", "Mejor puntuados"], ["skill", "Skill"],
  ["level_asc", "Nivel (menor a mayor)"], ["level_desc", "Nivel (mayor a menor)"], ["time", "Tiempo (menor a mayor)"],
];

export function ItemBrowser({ portal, modo, acciones, version = 0 }: Props) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [filtros, setFiltros] = useState({
    role_profile_id: "", min_level: 1, max_level: 7, item_type: "", scored: "", min_score: "", max_score: "",
    status: "active", order: "recent",
  });
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<{ total: number; items: ItemSummary[] }>({ total: 0, items: [] });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ItemDetailData | null>(null);
  const [error, setError] = useState("");

  // Catálogos para los filtros.
  useEffect(() => {
    api<Skill[]>(portal, `${CATALOG_URL}/skills`).then(setSkills).catch((e) => setError(e.message));
    api<RoleProfile[]>(portal, `${CATALOG_URL}/role-profiles`).then(setPerfiles).catch(() => {});
  }, [portal, modo]);

  const nueva = useVigencia();
  const cargarLista = useCallback(() => {
    const vigente = nueva();
    const { min_level, max_level, ...resto } = filtros;
    const q = new URLSearchParams(consulta({ ...resto, min_level: min_level === 1 ? "" : min_level, max_level: max_level === 7 ? "" : max_level,
      limit: LIMITE, offset: pagina * LIMITE }).slice(1));
    skillIds.forEach((id) => q.append("skill_ids", id));
    api<{ total: number; items: ItemSummary[] }>(portal, `${CONTENT_URL}/items?${q.toString()}`)
      .then((r) => { if (vigente()) { setLista(r); setError(""); } })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [portal, filtros, skillIds, pagina, version, nueva]);

  useEffect(cargarLista, [cargarLista]);

  const nuevaDetalle = useVigencia();
  const cargarDetalle = useCallback(() => {
    const vigente = nuevaDetalle();
    if (!abierto) return setDetalle(null);
    api<ItemDetailData>(portal, `${CONTENT_URL}/items/${abierto}`)
      .then((d) => { if (vigente()) setDetalle(d); })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [portal, abierto, nuevaDetalle]);

  useEffect(cargarDetalle, [cargarDetalle]);

  const porCodigo = new Map(skills.map((s) => [s.code, s]));
  const recargar = () => { cargarLista(); cargarDetalle(); };
  const cambiar = (campo: string, valor: string) => { setFiltros({ ...filtros, [campo]: valor }); setPagina(0); };
  const [barra, setBarra] = useState<HTMLElement | null>(null);

  return (
    <div className="banco">
      <section className="filtros">
        <FiltroSkills portal={portal} skills={skills} seleccion={skillIds} alCambiar={(ids) => { setSkillIds(ids); setPagina(0); }}
                      perfiles={modo === "docente" ? perfiles : undefined}
                      cargarPerfil={modo === "docente" ? (id) => api<RoleProfileDetail>(portal, `${CATALOG_URL}/role-profiles/${id}`) : undefined} />
        <div className="campo-filtro">
          <span>Nivel de responsabilidad: {filtros.min_level === 1 && filtros.max_level === 7 ? "cualquiera" : `${filtros.min_level} a ${filtros.max_level}`}</span>
          <NivelesRango desde={filtros.min_level} hasta={filtros.max_level} color="#4f5966" etiqueta="Nivel de responsabilidad"
                        alCambiar={(lo, hi) => { setFiltros({ ...filtros, min_level: lo, max_level: hi }); setPagina(0); }} />
        </div>
        {modo === "validador" && (
          <label>Rol
            <select value={filtros.role_profile_id} onChange={(e) => cambiar("role_profile_id", e.target.value)}>
              <option value="">Todos</option>
              {perfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label>Tipo
          <select value={filtros.item_type} onChange={(e) => cambiar("item_type", e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(NOMBRE_TIPO).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
          </select>
        </label>
        <label>Puntuación
          <select value={filtros.scored} onChange={(e) => cambiar("scored", e.target.value)}>
            <option value="">Todas</option>
            <option value="unscored">Sin puntuar</option>
            <option value="scored">Puntuados</option>
          </select>
        </label>
        <RangoEstrellas min={Number(filtros.min_score) || 1} max={Number(filtros.max_score) || 5}
                        alCambiar={(lo, hi) => {
                          setFiltros({ ...filtros, min_score: lo === 1 ? "" : String(lo), max_score: hi === 5 ? "" : String(hi) });
                          setPagina(0);
                        }} />
        {modo === "docente" && (
          <label>Estado
            <select value={filtros.status} onChange={(e) => cambiar("status", e.target.value)}>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="">Todos</option>
            </select>
          </label>
        )}
        <Ordenar valor={filtros.order} opciones={ORDENES} alCambiar={(v) => cambiar("order", v)} />
      </section>

      {error && <p className="error">{error}</p>}

      <div className="dos-columnas">
        <section className="lista">
          <div className="lista-cabecera">
            <span className="suave">{lista.total} ítem(s)</span>
            <Paginacion pagina={pagina} total={lista.total} limite={LIMITE} alCambiar={setPagina} />
          </div>
          {lista.items.map((i) => (
            <FilaItem key={i.id} activa={abierto === i.id} alPulsar={() => setAbierto(i.id)}
                      d={{ type: i.type, skill_code: i.skill_code, category: porCodigo.get(i.skill_code)?.category ?? null, level: i.level,
                           estimated_minutes: i.estimated_minutes, statement: i.statement, privado: modo === "docente" && !i.available_to_experts,
                           inactivo: i.status === "inactive", average_score: i.average_score, scores_count: i.scores_count }} />
          ))}
          {lista.total > LIMITE && <Paginacion pagina={pagina} total={lista.total} limite={LIMITE} alCambiar={setPagina} />}
        </section>

        <section className="panel">
          {detalle ? (
            <>
              <div className="panel-cabecera"><span className="barra-iconos" ref={setBarra} /></div>
              <ItemDetail item={detalle} categoria={porCodigo.get(detalle.skill.code)?.category ?? null} />
              {acciones?.(detalle, recargar, setAbierto, barra)}
            </>
          ) : (
            <p className="suave">Elige un ítem de la lista para ver sus atributos.</p>
          )}
        </section>
      </div>
    </div>
  );
}
