"use client";

// Paso 1 del constructor: las reglas de la evaluación (HU-11). Nombre, duración y las skills con sus niveles.
// Los niveles son de cada skill (por defecto, los que SFIA define para ella). Un rol solo aporta skills: el primero que
// se añade queda como rol de base y, si después se agregan o quitan skills, pasa a ser un rol personalizado que se
// puede guardar como rol propio (HU-38).
import { useConfirmar } from "../shared/useConfirmar";
import { useEffect, useState } from "react";
import { RolPicker } from "../docente/RolPicker";
import { api } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { BUILDER_URL, CATALOG_URL } from "../shared/config";
import { BarraFlotante } from "../shared/BarraFlotante";
import { Contador } from "../shared/Contador";
import { FichaSkill } from "../shared/DescripcionSkill";
import { Icono } from "../shared/Estrellas";
import { NivelesRango } from "../shared/NivelesRango";
import { SkillPicker } from "../shared/SkillPicker";
import { Ventana } from "../shared/Ventana";
import type { CustomRoleDetail, CustomRoleSummary, EvaluationDetail, RoleProfile, RoleProfileDetail, Skill, TemplateSummary } from "../shared/types";

interface Fila { skill_id: string; min_level: number; max_level: number; items_count: number }
interface RolBase { id: string; name: string; skillIds: string[] }

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
  const [confirmar, dialogoConfirmar] = useConfirmar();
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
  const [vistas, setVistas] = useState<Set<string>>(new Set()); // skills sobre las que se pasó el cursor (se pide su descripción)
  const ver = (id: string) => setVistas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

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

  const cambiarRango = (skillId: string, desde: number, hasta: number) =>
    setFilas((prev) => prev.map((f) => (f.skill_id === skillId ? { ...f, min_level: desde, max_level: hasta } : f)));

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
    if ((nombre.trim() || filas.length > 0) && !await confirmar("Se creará una evaluación nueva desde la plantilla y se dejará lo que llevas sin guardar. ¿Continuar?")) return;
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
    <div className="con-barra-flotante">
    <div className="dos-columnas cols-reglas">
      {dialogoConfirmar}
      <div className="panel formulario">
        <h3 className="m-0">Datos</h3>
        <label>Nombre de la evaluación
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} />
        </label>
        <span className="formulario-campo">Duración total (min) <span className="suave">opcional; si queda vacía será la suma de los ítems</span>
          <Contador etiqueta="Duración total (min)" valor={duracion.trim() ? Number(duracion) : null} alCambiar={(n) => setDuracion(n === null ? "" : String(n))} />
        </span>
        {id === null && <button type="button" onClick={abrirPlantillas}>Partir de una plantilla…</button>}
        {rolBase && (
          <p className={`${personalizado ? "aviso" : "suave"} m-0`}>
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
        {aviso && <p className="ok m-0">{aviso}</p>}
        {error && <p className="error m-0">{error}</p>}
      </div>

      <div className="panel">
        <h3 className="mb-5">Skills de la evaluación ({filas.length})</h3>
        <div className="acciones">
          <SkillPicker skills={skills} alElegir={(sid) => { const s = porId.get(sid); if (s) agregar([{ id: s.id, min_level: s.min_level, max_level: s.max_level }]); }} />
          <RolPicker perfiles={perfiles} skills={skills} cargarPerfil={(rid) => api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${rid}`)}
                     yaEnFormulario={enFormulario}
                     alAgregar={(lista, rol) => {
                       agregar(lista.map((s) => ({ id: s.id, min_level: s.min_level, max_level: s.max_level })));
                       setRolBase((prev) => prev ?? { id: rol.id, name: rol.name, skillIds: rol.skills.map((s) => s.id) });
                     }} />
          <button type="button" onClick={abrirRolesPropios}>Añadir desde un rol propio</button>
        </div>
        {filas.length === 0 && <p className="suave">Añade skills (o las skills de un rol) para definir qué se evaluará.</p>}
        {filas.map((f) => {
          const s = porId.get(f.skill_id);
          const color = colorDe(s?.category ?? null);
          const fuera = s !== undefined && (f.min_level < s.min_level || f.max_level > s.max_level);
          return (
            <div key={f.skill_id} className="skill-eval" style={{ ["--cat" as string]: color }} onMouseEnter={() => ver(f.skill_id)} onFocus={() => ver(f.skill_id)}>
              <div className="skill-eval-fila">
                <div className="skill-eval-datos">
                  <span className="skill-codigo" style={{ background: color }}>{s?.code ?? "…"}</span>{" "}
                  <strong>{s?.name ?? ""}</strong>
                </div>
                <NivelesRango desde={f.min_level} hasta={f.max_level} color={color} sfia={s ? [s.min_level, s.max_level] : undefined}
                              etiqueta={`Niveles de ${s?.code ?? "la skill"}`} alCambiar={(d, h) => cambiarRango(f.skill_id, d, h)} />
                {fuera && <span className="etiqueta">fuera del rango SFIA</span>}
                {f.items_count > 0 && <span className="etiqueta">{f.items_count} ítem{f.items_count === 1 ? "" : "s"}</span>}
                <button type="button" className="icono-btn peligro" disabled={f.items_count > 0}
                        title={f.items_count > 0 ? "Quita primero sus ítems (paso 2)" : "Quitar la skill"}
                        aria-label={`Quitar ${s?.code ?? "la skill"}`} onClick={() => setFilas((prev) => prev.filter((x) => x.skill_id !== f.skill_id))}>
                  <Icono nombre="descartar" />
                </button>
              </div>
              {s && <div className="skill-eval-detalle"><div><FichaSkill skill={s} color={color} activo={vistas.has(f.skill_id)} /></div></div>}
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
                  <span className="suave bloque">
                    {t.skills_count} skills · {t.items_count} ítems
                    {!t.available && t.blocked_items && ` · ${t.blocked_items.map((b) => `${b.skill_code}: ${b.reason}`).join(", ")}`}
                  </span>
                </span>
              </button>
            ))}
        </Ventana>
      )}
    </div>
    <BarraFlotante>
      <button disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
      <button className="primario" disabled={ocupado} onClick={async () => { if (await guardar()) alSiguiente(); }}>Siguiente: ítems →</button>
    </BarraFlotante>
    </div>
  );
}
