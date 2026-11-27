"use client";

// Mis roles (HU-38): conjuntos de skills guardados para reutilizarlos al armar una evaluación. Un rol solo define qué
// skills se incluyen (no sus niveles) y es privado: lo ve, edita y borra su dueño.
import { useConfirmar } from "../shared/useConfirmar";
import { useCallback, useEffect, useState } from "react";
import { RolPicker } from "../docente/RolPicker";
import { api } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { Icono } from "../shared/Estrellas";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { SkillPicker } from "../shared/SkillPicker";
import { ErrorCarga } from "../shared/EstadoCarga";
import { useVigencia } from "../shared/useVigencia";
import type { CustomRoleDetail, CustomRoleSummary, RoleProfile, RoleProfileDetail, Skill } from "../shared/types";

interface Edicion { id: string | null; nombre: string; skillIds: string[] }

export function ListaRoles() {
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [lista, setLista] = useState<CustomRoleSummary[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [error, setError] = useState("");

  const nueva = useVigencia();
  const cargar = useCallback(() => {
    const vigente = nueva();
    api<CustomRoleSummary[]>("docente", `${BUILDER_URL}/custom-roles`)
      .then((r) => { if (vigente()) { setLista(r); setError(""); } })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [nueva]);
  useEffect(cargar, [cargar]);
  useEffect(() => {
    api<Skill[]>("docente", `${CATALOG_URL}/skills`).then(setSkills).catch((e) => setError(e.message));
    api<RoleProfile[]>("docente", `${CATALOG_URL}/role-profiles`).then(setPerfiles).catch(() => {});
  }, []);

  const porId = new Map(skills.map((s) => [s.id, s]));
  const abrir = async (r: CustomRoleSummary) => {
    try {
      const d = await api<CustomRoleDetail>("docente", `${BUILDER_URL}/custom-roles/${r.id}`);
      setEdicion({ id: d.id, nombre: d.name, skillIds: d.skills.map((s) => s.id) }); setError("");
    } catch (e) { setError((e as Error).message); }
  };
  const borrar = async (r: CustomRoleSummary) => {
    if (!await confirmar(`¿Borrar el rol «${r.name}»?`)) return;
    try { await api("docente", `${BUILDER_URL}/custom-roles/${r.id}`, { method: "DELETE" }); cargar(); }
    catch (e) { setError((e as Error).message); }
  };
  const guardar = async () => {
    if (!edicion) return;
    try {
      await api("docente", edicion.id ? `${BUILDER_URL}/custom-roles/${edicion.id}` : `${BUILDER_URL}/custom-roles`,
        { method: edicion.id ? "PUT" : "POST", body: { name: edicion.nombre, skill_ids: edicion.skillIds } });
      setEdicion(null); setError(""); cargar();
    } catch (e) { setError((e as Error).message); }
  };
  const agregar = (ids: string[]) => setEdicion((e) => e && { ...e, skillIds: [...e.skillIds, ...ids.filter((i) => !e.skillIds.includes(i))] });

  return (
    <section>
      {dialogoConfirmar}
      <div className="acciones entre">
        <h2 className="m-0">Mis roles</h2>
        <button className="primario" onClick={() => { setEdicion({ id: null, nombre: "", skillIds: [] }); setError(""); }}>+ Nuevo rol</button>
      </div>
      {error && lista !== null && <p className="error">{error}</p>}
      <div className="dos-columnas cols-roles mt-6">
        <div className="panel">
          {lista === null ? (error ? <ErrorCarga mensaje={error} alReintentar={() => { setError(""); cargar(); }} /> : <p className="suave">Cargando…</p>) : lista.length === 0 ? <p className="suave">Todavía no tienes roles propios.</p> : lista.map((r) => (
            <div key={r.id} className="fila-banco">
              <div className="fila-eval-datos"><strong>{r.name}</strong><span className="suave">{r.skills_count} skills</span></div>
              <button onClick={() => abrir(r)}>Editar</button>
              <button className="peligro" onClick={() => borrar(r)}>Borrar</button>
            </div>
          ))}
        </div>
        {edicion && (
          <div className="panel formulario ancho-total">
            <h3 className="m-0">{edicion.id ? "Editar rol" : "Nuevo rol"}</h3>
            <label>Nombre
              <input value={edicion.nombre} maxLength={100} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
            </label>
            <div className="acciones">
              <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={(id) => api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${id}`)}
                         yaEnFormulario={new Set(edicion.skillIds)} alAgregar={(lista) => agregar(lista.map((s) => s.id))} />
              <SkillPicker skills={skills} alElegir={(id) => agregar([id])} />
            </div>
            <p className="m-0"><strong>Skills ({edicion.skillIds.length})</strong> <span className="suave">un rol no define niveles: se fijan en cada evaluación</span></p>
            <div>
              {edicion.skillIds.map((id) => {
                const s = porId.get(id);
                return (
                  <span key={id} className="skill-codigo chip-rol" style={{ background: colorDe(s?.category ?? null) }}>
                    {s?.code ?? "…"}{" "}
                    <button type="button" className="chip-quitar" aria-label={`Quitar ${s?.code ?? "la skill"}`}
                            onClick={() => setEdicion({ ...edicion, skillIds: edicion.skillIds.filter((x) => x !== id) })}><Icono nombre="cerrar" /></button>
                  </span>
                );
              })}
            </div>
            <div className="acciones">
              <button className="primario" disabled={!edicion.nombre.trim() || edicion.skillIds.length === 0} onClick={guardar}>Guardar rol</button>
              <button onClick={() => setEdicion(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
