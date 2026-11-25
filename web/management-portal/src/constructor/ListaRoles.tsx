"use client";

// Mis roles (HU-38): conjuntos de skills guardados para reutilizarlos al armar una evaluación. Un rol solo define qué
// skills se incluyen (no sus niveles) y es privado: lo ve, edita y borra su dueño.
import { useCallback, useEffect, useState } from "react";
import { RolPicker } from "../docente/RolPicker";
import { api } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { SkillPicker } from "../shared/SkillPicker";
import type { CustomRoleDetail, CustomRoleSummary, RoleProfile, RoleProfileDetail, Skill } from "../shared/types";

interface Edicion { id: string | null; nombre: string; skillIds: string[] }

export function ListaRoles() {
  const [lista, setLista] = useState<CustomRoleSummary[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    api<CustomRoleSummary[]>("docente", `${BUILDER_URL}/custom-roles`).then((r) => { setLista(r); setError(""); }).catch((e) => setError(e.message));
  }, []);
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
    if (!window.confirm(`¿Borrar el rol «${r.name}»?`)) return;
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
      <div className="acciones" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Mis roles</h2>
        <button className="primario" onClick={() => { setEdicion({ id: null, nombre: "", skillIds: [] }); setError(""); }}>+ Nuevo rol</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dos-columnas" style={{ gridTemplateColumns: "1fr 1.4fr", marginTop: ".6rem" }}>
        <div className="panel">
          {lista === null ? <p className="suave">Cargando…</p> : lista.length === 0 ? <p className="suave">Todavía no tienes roles propios.</p> : lista.map((r) => (
            <div key={r.id} className="fila-banco">
              <div className="fila-eval-datos"><strong>{r.name}</strong><span className="suave">{r.skills_count} skills</span></div>
              <button onClick={() => abrir(r)}>Editar</button>
              <button className="peligro" onClick={() => borrar(r)}>Borrar</button>
            </div>
          ))}
        </div>
        {edicion && (
          <div className="panel formulario" style={{ maxWidth: "none" }}>
            <h3 style={{ margin: 0 }}>{edicion.id ? "Editar rol" : "Nuevo rol"}</h3>
            <label>Nombre
              <input value={edicion.nombre} maxLength={100} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
            </label>
            <div className="acciones">
              <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={(id) => api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${id}`)}
                         yaEnFormulario={new Set(edicion.skillIds)} alAgregar={(lista) => agregar(lista.map((s) => s.id))} />
              <SkillPicker skills={skills} alElegir={(id) => agregar([id])} />
            </div>
            <p style={{ margin: 0 }}><strong>Skills ({edicion.skillIds.length})</strong> <span className="suave">un rol no define niveles: se fijan en cada evaluación</span></p>
            <div>
              {edicion.skillIds.map((id) => {
                const s = porId.get(id);
                return (
                  <span key={id} className="skill-codigo" style={{ background: colorDe(s?.category ?? null), marginRight: ".4rem", display: "inline-block", marginBottom: ".3rem" }}>
                    {s?.code ?? "…"}{" "}
                    <button type="button" aria-label={`Quitar ${s?.code ?? "la skill"}`} style={{ border: "none", background: "none", color: "#fff", padding: 0, cursor: "pointer" }}
                            onClick={() => setEdicion({ ...edicion, skillIds: edicion.skillIds.filter((x) => x !== id) })}>✕</button>
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
