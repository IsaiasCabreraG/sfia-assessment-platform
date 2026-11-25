"use client";

// Banco de ítems: filtros (HU-07), lista con puntuación (HU-25) y detalle (HU-08) de un ítem.
// Lo usan los dos portales; `modo` decide qué filtros se ofrecen y `acciones` agrega los botones propios
// de cada portal (activar/desactivar en el docente, puntuar en el validador).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, consulta } from "./api";
import type { Portal } from "./auth";
import { CATALOG_URL, CONTENT_URL } from "./config";
import { colorDe } from "./categorias";
import { IconoTipo } from "./IconoTipo";
import { ItemDetail, NOMBRE_TIPO, Puntuacion } from "./ItemDetail";
import { NivelChip } from "./Niveles";
import { RangoEstrellas } from "./RangoEstrellas";
import { SkillPicker } from "./SkillPicker";
import type { ItemDetailData, ItemSummary, Level, RoleProfile, Skill } from "./types";

interface Props {
  portal: Portal;
  modo: "docente" | "validador";
  /** Botones propios del portal para el ítem abierto; `recargar` actualiza lista y detalle. */
  acciones?: (item: ItemDetailData, recargar: () => void, abrir: (id: string) => void) => ReactNode;
  /** Cambia cuando otra pantalla crea ítems, para volver a consultar la lista. */
  version?: number;
}

const LIMITE = 20;

export function ItemBrowser({ portal, modo, acciones, version = 0 }: Props) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [niveles, setNiveles] = useState<Level[]>([]);
  const [filtros, setFiltros] = useState({
    skill_id: "", role_profile_id: "", level: "", item_type: "", scored: "", min_score: "", max_score: "",
    status: "active", mine: "",
  });
  const [pagina, setPagina] = useState(0);
  const [lista, setLista] = useState<{ total: number; items: ItemSummary[] }>({ total: 0, items: [] });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ItemDetailData | null>(null);
  const [error, setError] = useState("");

  // Catálogos para los filtros.
  useEffect(() => {
    api<Skill[]>(portal, `${CATALOG_URL}/skills`).then(setSkills).catch((e) => setError(e.message));
    api<Level[]>(portal, `${CATALOG_URL}/levels`).then(setNiveles).catch(() => {});
    if (modo === "validador") api<RoleProfile[]>(portal, `${CATALOG_URL}/role-profiles`).then(setPerfiles).catch(() => {});
  }, [portal, modo]);

  const cargarLista = useCallback(() => {
    api<{ total: number; items: ItemSummary[] }>(
      portal,
      `${CONTENT_URL}/items${consulta({ ...filtros, limit: LIMITE, offset: pagina * LIMITE })}`,
    )
      .then((r) => { setLista(r); setError(""); })
      .catch((e) => setError(e.message));
  }, [portal, filtros, pagina, version]);

  useEffect(cargarLista, [cargarLista]);

  const cargarDetalle = useCallback(() => {
    if (!abierto) return setDetalle(null);
    api<ItemDetailData>(portal, `${CONTENT_URL}/items/${abierto}`).then(setDetalle).catch((e) => setError(e.message));
  }, [portal, abierto]);

  useEffect(cargarDetalle, [cargarDetalle]);

  const skillFiltrada = skills.find((s) => s.id === filtros.skill_id);
  const recargar = () => { cargarLista(); cargarDetalle(); };
  const cambiar = (campo: string, valor: string) => { setFiltros({ ...filtros, [campo]: valor }); setPagina(0); };

  return (
    <div className="banco">
      <section className="filtros">
        <div className="campo-filtro">
          <span>Skill</span>
          <SkillPicker skills={skills} alElegir={(id) => cambiar("skill_id", id)} alLimpiar={() => cambiar("skill_id", "")}
                       texto={skillFiltrada ? `${skillFiltrada.code} · ${skillFiltrada.name} ▾` : "Todas ▾"} />
        </div>
        <label>Nivel de responsabilidad
          <select value={filtros.level} onChange={(e) => cambiar("level", e.target.value)}>
            <option value="">Todos</option>
            {niveles.map((n) => <option key={n.level} value={n.level}>{n.level} · {n.description}</option>)}
          </select>
        </label>
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
        {modo === "docente" && (
          <label className="check">
            <input type="checkbox" checked={filtros.mine === "true"} onChange={(e) => cambiar("mine", e.target.checked ? "true" : "")} />
            Solo mis ítems
          </label>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="dos-columnas">
        <section className="lista">
          <p className="suave">{lista.total} ítem(s)</p>
          {lista.items.map((i) => (
            <button key={i.id} className={`fila ${abierto === i.id ? "activa" : ""}`} onClick={() => setAbierto(i.id)}>
              <span className="fila-titulo">
                <span className="fila-datos">
                  <IconoTipo tipo={i.type} />{" "}
                  <strong>{i.skill_code}</strong>{" "}
                  <NivelChip nivel={i.level} color={colorDe(skills.find((s) => s.code === i.skill_code)?.category ?? null)} />{" "}
                  <span className="suave">{i.estimated_minutes} min</span>
                  {i.status === "inactive" && <span className="etiqueta">inactivo</span>}
                  {modo === "docente" && <span className={`etiqueta ${i.available_to_experts ? "publico" : ""}`}>{i.available_to_experts ? "público" : "privado"}</span>}
                </span>
                <Puntuacion promedio={i.average_score} cantidad={i.scores_count} />
              </span>
              <span className="enunciado">{i.statement}</span>
            </button>
          ))}
          <div className="paginacion">
            <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina + 1}</span>
            <button disabled={(pagina + 1) * LIMITE >= lista.total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        </section>

        <section className="panel">
          {detalle ? (
            <>
              <ItemDetail item={detalle} />
              {acciones?.(detalle, recargar, setAbierto)}
            </>
          ) : (
            <p className="suave">Elige un ítem de la lista para ver sus atributos.</p>
          )}
        </section>
      </div>
    </div>
  );
}
