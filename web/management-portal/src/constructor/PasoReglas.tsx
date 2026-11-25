"use client";

// Paso 1 del constructor: las reglas de la evaluación (HU-11). Nombre, duración y las skills con sus niveles.
// Los niveles son de cada skill (por defecto, los que SFIA define para ella). Un rol solo aporta skills: el primero que
// se añade queda como rol de base y, si después se agregan o quitan skills, pasa a ser un rol personalizado que se
// puede guardar como rol propio (HU-38).
import { useEffect, useState } from "react";
import { RolPicker } from "../docente/RolPicker";
import { api } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { SkillPicker } from "../shared/SkillPicker";
import { Ventana } from "./Ventana";
import type { CustomRoleDetail, CustomRoleSummary, EvaluationDetail, RoleProfile, RoleProfileDetail, Skill, TemplateSummary } from "../shared/types";

interface Fila { skill_id: string; min_level: number; max_level: number; items_count: number }
interface RolBase { id: string; name: string; skillIds: string[] }
const NIVELES = [1, 2, 3, 4, 5, 6, 7];

const aFilas = (d: EvaluationDetail): Fila[] =>
  d.skills.map((s) => ({ skill_id: s.id, min_level: s.min_level, max_level: s.max_level, items_count: s.items_count }));

interface Props {
  detalle: EvaluationDetail | null;
  alAbrir: (id: string) => void;
  /** Se llama con la evaluación guardada, para que el asistente la conserve al pasar de paso. */
  alGuardar: (d: EvaluationDetail) => void;
  alSiguiente: () => void;
}

export function PasoReglas({ detalle, alAbrir, alGuardar, alSiguiente }: Props) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [id, setId] = useState<string | null>(detalle?.id ?? null);
  const [nombre, setNombre] = useState(detalle?.name ?? "");
  const [duracion, setDuracion] = useState(detalle?.duration_minutes != null ? String(detalle.duration_minutes) : "");
  const [filas, setFilas] = useState<Fila[]>(detalle ? aFilas(detalle) : []);
  const [rolBase, setRolBase] = useState<RolBase | null>(null);
  const [ventana, setVentana] = useState<null | "rol-propio" | "plantilla">(null);
  const [rolesPropios, setRolesPropios] = useState<CustomRoleSummary[] | null>(null);
  const [plantillas, setPlantillas] = useState<TemplateSummary[] | null>(null);
  const [nombreRol, setNombreRol] = useState<string | null>(null); // null = el formulario de «guardar como rol propio» está cerrado
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<Skill[]>("docente", `${CATALOG_URL}/skills`).then(setSkills).catch((e) => setError(e.message));
    api<RoleProfile[]>("docente", `${CATALOG_URL}/role-profiles`).then(setPerfiles).catch(() => {});
  }, []);

  // Al continuar un borrador, se recupera el rol de base para saber si sigue siendo el del rol o ya es personalizado.
  useEffect(() => {
    const rol = detalle?.role_profile;
    if (!rol) return;
    api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${rol.id}`)
      .then((r) => setRolBase({ id: r.id, name: r.name, skillIds: r.skills.map((s) => s.id) }))
      .catch(() => {});
  }, [detalle]);

  const porId = new Map(skills.map((s) => [s.id, s]));
  const enFormulario = new Set(filas.map((f) => f.skill_id));
  const personalizado = rolBase !== null &&
    (rolBase.skillIds.length !== enFormulario.size || rolBase.skillIds.some((s) => !enFormulario.has(s)));

  const agregar = (nuevas: { id: string; min_level: number; max_level: number }[]) =>
    setFilas((prev) => [...prev, ...nuevas.filter((n) => !prev.some((f) => f.skill_id === n.id))
      .map((n) => ({ skill_id: n.id, min_level: n.min_level, max_level: n.max_level, items_count: 0 }))]);

  const cambiarNivel = (skillId: string, campo: "min_level" | "max_level", valor: number) =>
    setFilas((prev) => prev.map((f) => {
      if (f.skill_id !== skillId) return f;
      const g = { ...f, [campo]: valor };
      if (g.min_level > g.max_level) { if (campo === "min_level") g.max_level = valor; else g.min_level = valor; }
      return g;
    }));

  const abrirRolesPropios = () => {
    setVentana("rol-propio");
    api<CustomRoleSummary[]>("docente", `${BUILDER_URL}/custom-roles`).then(setRolesPropios).catch((e) => setError(e.message));
  };
  const abrirPlantillas = () => {
    setVentana("plantilla");
    api<TemplateSummary[]>("docente", `${BUILDER_URL}/templates`).then(setPlantillas).catch((e) => setError(e.message));
  };

  const usarRolPropio = async (r: CustomRoleSummary) => {
    try {
      const d = await api<CustomRoleDetail>("docente", `${BUILDER_URL}/custom-roles/${r.id}`);
      agregar(d.skills.map((s) => ({ id: s.id, min_level: s.min_level, max_level: s.max_level })));
      setVentana(null);
    } catch (e) { setError((e as Error).message); }
  };

  const usarPlantilla = async (t: TemplateSummary) => {
    if ((nombre.trim() || filas.length > 0) && !window.confirm("Se creará una evaluación nueva desde la plantilla y se dejará lo que llevas sin guardar. ¿Continuar?")) return;
    try {
      const nueva = await api<{ id: string }>("docente", `${BUILDER_URL}/templates/${t.id}/use`, { method: "POST", body: {} });
      alAbrir(nueva.id);
    } catch (e) { setError((e as Error).message); setVentana(null); }
  };

  const guardarRolPropio = async () => {
    try {
      const r = await api<CustomRoleDetail>("docente", `${BUILDER_URL}/custom-roles`, {
        method: "POST", body: { name: nombreRol, skill_ids: filas.map((f) => f.skill_id) } });
      setNombreRol(null); setError(""); setAviso(`Rol propio «${r.name}» guardado.`);
    } catch (e) { setError((e as Error).message); }
  };

  /** Guarda (crea o actualiza) el borrador. Devuelve true si quedó guardado. */
  const guardar = async (): Promise<boolean> => {
    if (!nombre.trim()) { setError("Escribe un nombre para la evaluación."); return false; }
    setOcupado(true); setError(""); setAviso("");
    const cuerpo = {
      name: nombre, role_profile_id: rolBase?.id ?? null, duration_minutes: duracion.trim() ? Number(duracion) : null,
      skills: filas.map((f) => ({ skill_id: f.skill_id, min_level: f.min_level, max_level: f.max_level })),
    };
    try {
      const d = await api<EvaluationDetail>("docente", id ? `${BUILDER_URL}/evaluations/${id}` : `${BUILDER_URL}/evaluations`,
        { method: id ? "PUT" : "POST", body: cuerpo });
      setId(d.id); setFilas(aFilas(d)); setAviso("Guardado."); alGuardar(d);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setOcupado(false); }
  };

  return (
    <div className="dos-columnas" style={{ gridTemplateColumns: "minmax(260px, 1fr) 2.1fr" }}>
      <div className="panel formulario">
        <h3 style={{ margin: 0 }}>Datos</h3>
        <label>Nombre de la evaluación
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} />
        </label>
        <label>Duración total (min) <span className="suave">opcional; si queda vacía será la suma de los ítems</span>
          <input type="number" min="1" value={duracion} onChange={(e) => setDuracion(e.target.value)} />
        </label>
        {id === null && <button type="button" onClick={abrirPlantillas}>Partir de una plantilla…</button>}
        {rolBase && (
          <p className={personalizado ? "aviso" : "suave"} style={{ margin: 0 }}>
            Rol de base: <strong>{rolBase.name}</strong>.{" "}
            {personalizado ? <>Las skills ya no son las del rol: ahora es un <strong>rol personalizado</strong>.</> : "Las skills son las del rol."}
          </p>
        )}
        {filas.length > 0 && (personalizado || rolBase === null) && (
          nombreRol === null
            ? <button type="button" onClick={() => setNombreRol("")}>Guardar como rol propio</button>
            : (
              <div className="acciones">
                <input aria-label="Nombre del rol propio" placeholder="Nombre del rol" value={nombreRol} maxLength={100}
                       onChange={(e) => setNombreRol(e.target.value)} />
                <button type="button" className="primario" disabled={!nombreRol.trim()} onClick={guardarRolPropio}>Guardar rol</button>
                <button type="button" onClick={() => setNombreRol(null)}>Cancelar</button>
              </div>
            )
        )}
        <div className="acciones">
          <button disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
          <button className="primario" disabled={ocupado} onClick={async () => { if (await guardar()) alSiguiente(); }}>Siguiente: ítems →</button>
        </div>
        {aviso && <p className="ok" style={{ margin: 0 }}>{aviso}</p>}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 .5rem" }}>Skills de la evaluación ({filas.length})</h3>
        <div className="acciones">
          <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={(rid) => api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${rid}`)}
                     yaEnFormulario={enFormulario}
                     alAgregar={(lista, rol) => {
                       agregar(lista.map((s) => ({ id: s.id, min_level: s.min_level, max_level: s.max_level })));
                       setRolBase((prev) => prev ?? { id: rol.id, name: rol.name, skillIds: rol.skills.map((s) => s.id) });
                     }} />
          <button type="button" onClick={abrirRolesPropios}>+ Añadir skills de un rol propio…</button>
          <SkillPicker skills={skills} alElegir={(sid) => { const s = porId.get(sid); if (s) agregar([{ id: s.id, min_level: s.min_level, max_level: s.max_level }]); }} />
        </div>
        {filas.length === 0 && <p className="suave">Añade skills (o las skills de un rol) para definir qué se evaluará.</p>}
        {filas.map((f) => {
          const s = porId.get(f.skill_id);
          const fuera = s !== undefined && (f.min_level < s.min_level || f.max_level > s.max_level);
          return (
            <div key={f.skill_id} className="skill-eval">
              <div className="skill-eval-datos">
                <span className="skill-codigo" style={{ background: colorDe(s?.category ?? null) }}>{s?.code ?? "…"}</span>{" "}
                <strong>{s?.name ?? ""}</strong>
                {s && <div className="suave">SFIA define esta skill en los niveles {s.min_level} a {s.max_level}</div>}
              </div>
              <div className="skill-eval-niveles">
                <span className="suave">Niveles en esta evaluación</span>
                <div>
                  <select aria-label={`Nivel mínimo de ${s?.code ?? "la skill"}`} value={f.min_level} onChange={(e) => cambiarNivel(f.skill_id, "min_level", Number(e.target.value))}>
                    {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {" a "}
                  <select aria-label={`Nivel máximo de ${s?.code ?? "la skill"}`} value={f.max_level} onChange={(e) => cambiarNivel(f.skill_id, "max_level", Number(e.target.value))}>
                    {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                {fuera && <span className="etiqueta">fuera del rango SFIA</span>}
              </div>
              {f.items_count > 0 && <span className="etiqueta">{f.items_count} ítem{f.items_count === 1 ? "" : "s"}</span>}
              <button type="button" className="peligro" disabled={f.items_count > 0}
                      title={f.items_count > 0 ? "Quita primero sus ítems (paso 2)" : undefined}
                      aria-label={`Quitar ${s?.code ?? "la skill"}`} onClick={() => setFilas((prev) => prev.filter((x) => x.skill_id !== f.skill_id))}>Quitar</button>
            </div>
          );
        })}
      </div>

      {ventana === "rol-propio" && (
        <Ventana titulo="Añadir skills de un rol propio" alCerrar={() => setVentana(null)}>
          {rolesPropios === null ? <p className="suave">Cargando…</p> : rolesPropios.length === 0
            ? <p className="suave">Todavía no tienes roles propios. Se crean con «Guardar como rol propio».</p>
            : rolesPropios.map((r) => (
              <button key={r.id} type="button" className="rol-opcion" onClick={() => usarRolPropio(r)}>
                <span>{r.name}</span><span className="suave">{r.skills_count} skills</span>
              </button>
            ))}
        </Ventana>
      )}
      {ventana === "plantilla" && (
        <Ventana titulo="Partir de una plantilla" alCerrar={() => setVentana(null)}>
          {plantillas === null ? <p className="suave">Cargando…</p> : plantillas.length === 0
            ? <p className="suave">No hay plantillas disponibles.</p>
            : plantillas.map((t) => (
              <button key={t.id} type="button" className="rol-opcion" disabled={!t.available} onClick={() => usarPlantilla(t)}>
                <span>
                  <strong>{t.name}</strong>{" "}
                  <span className="etiqueta">{t.visibility === "public" ? "pública" : "privada"}</span>
                  <span className="etiqueta">{t.mine ? "mía" : `de ${t.owner_name ?? "otro docente"}`}</span>
                  {!t.available && <span className="etiqueta">no disponible</span>}
                  <span className="suave" style={{ display: "block" }}>
                    {t.skills_count} skills · {t.items_count} ítems
                    {!t.available && t.blocked_items && ` · ${t.blocked_items.map((b) => `${b.skill_code}: ${b.reason}`).join(", ")}`}
                  </span>
                </span>
              </button>
            ))}
        </Ventana>
      )}
    </div>
  );
}
