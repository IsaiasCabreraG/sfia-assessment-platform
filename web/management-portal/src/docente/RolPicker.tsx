"use client";

// Menú "+ Añadir skills de un rol": ventana con los roles SFIA agrupados por familia. Al elegir un rol se ven sus skills
// core y related por separado; el docente marca las que quiere y se agregan al formulario. No se guarda de qué rol
// salieron: se pueden añadir skills de un rol y después de otro.
import { useEffect, useMemo, useState } from "react";
import { colorDe } from "../shared/categorias";
import { Niveles } from "../shared/Niveles";
import type { RoleProfile, RoleProfileDetail, Skill } from "../shared/types";

type SkillDeRol = RoleProfileDetail["skills"][number];

const COLOR_FAMILIA = "#1f4e79";
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "AGILE DELIVERY ROLE FAMILY" → "Agile delivery". */
export function nombreFamilia(familia: string | null): string {
  const base = (familia ?? "Sin familia").replace(/\s*ROLE FAMILY\s*$/i, "").trim().toLowerCase();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

interface Props {
  perfiles: RoleProfile[];
  /** Todas las skills del catálogo: de ahí sale el color de la categoría de cada una. */
  skills: Skill[];
  cargarPerfil: (id: string) => Promise<RoleProfileDetail>;
  /** Ids de las skills que ya están en el formulario: se muestran marcadas y no se pueden desmarcar desde aquí. */
  yaEnFormulario: Set<string>;
  /** Recibe las skills marcadas y el rol del que salieron (el constructor lo guarda como rol de base). */
  alAgregar: (skills: SkillDeRol[], rol: RoleProfileDetail) => void;
}

export function RolPicker({ perfiles, skills, cargarPerfil, yaEnFormulario, alAgregar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [rol, setRol] = useState<RoleProfileDetail | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  const q = normalizar(busqueda.trim());
  const familias = useMemo(() => {
    const mapa = new Map<string, RoleProfile[]>();
    for (const p of perfiles) {
      if (q && !normalizar(p.name).includes(q)) continue;
      const f = nombreFamilia(p.family);
      mapa.set(f, [...(mapa.get(f) ?? []), p]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([nombre, roles]) => ({ nombre, roles: roles.sort((x, y) => x.name.localeCompare(y.name)) }));
  }, [perfiles, q]);

  const cerrar = () => { setAbierto(false); setBusqueda(""); setRol(null); setMarcadas(new Set()); setError(""); };

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const alternarFamilia = (f: string) => setExpandidas((prev) => { const n = new Set(prev); if (!n.delete(f)) n.add(f); return n; });

  const elegirRol = async (p: RoleProfile) => {
    setCargando(true); setError("");
    try {
      setRol(await cargarPerfil(p.id));
      setMarcadas(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const alternarSkill = (id: string) => setMarcadas((prev) => { const n = new Set(prev); if (!n.delete(id)) n.add(id); return n; });

  const agregar = () => {
    if (!rol) return;
    alAgregar(rol.skills.filter((s) => marcadas.has(s.id) && !yaEnFormulario.has(s.id)), rol);
    cerrar();
  };

  const grupo = (titulo: string, lista: SkillDeRol[]) => (
    <section className="rol-grupo">
      <h4>{titulo} ({lista.length})</h4>
      {lista.length === 0 && <p className="suave">Este rol no tiene skills {titulo.toLowerCase().replace("skills ", "")}.</p>}
      {lista.map((s) => {
        const ya = yaEnFormulario.has(s.id);
        const marcada = ya || marcadas.has(s.id);
        const color = colorDe(skills.find((x) => x.id === s.id)?.category ?? null);
        // Cada skill es una tarjeta con borde; al elegirla se rellena con el color de su categoría.
        return (
          <button key={s.id} type="button" role="checkbox" aria-checked={marcada} disabled={ya}
                  className={`skill-tarjeta ${marcada ? "marcada" : ""} ${ya ? "ya-esta" : ""}`} style={{ ["--cat" as string]: color }}
                  onClick={() => alternarSkill(s.id)}>
            <span className="codigo">{s.code}</span>
            <span className="nombre">{s.name}</span>
            {ya ? <span className="etiqueta">✓ ya está en el formulario</span> : <span />}
            <Niveles min={s.min_level} max={s.max_level} color={color} />
          </button>
        );
      })}
    </section>
  );

  const nuevas = rol ? rol.skills.filter((s) => marcadas.has(s.id) && !yaEnFormulario.has(s.id)).length : 0;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>+ Añadir skills de un rol…</button>
      {abierto && (
        <div className="menu-fondo" onClick={cerrar}>
          <div className={`menu-skills ${rol ? "angosto" : ""}`} role="dialog" aria-label="Añadir skills de un rol" onClick={(e) => e.stopPropagation()}>
            {!rol ? (
              <>
                <div className="menu-cabecera">
                  <strong>Elige un rol SFIA</strong>
                  <input type="search" className="menu-busqueda" autoFocus placeholder="Buscar rol…" aria-label="Buscar rol"
                         value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  <button type="button" onClick={cerrar} aria-label="Cerrar">×</button>
                </div>
                <p className="suave">Los roles están agrupados por familia. Al elegir uno verás sus skills y marcarás las que quieres añadir.</p>
                {error && <p className="error">{error}</p>}
                {cargando && <p className="suave">Cargando el rol…</p>}
                {familias.length === 0 && <p className="suave">Ningún rol coincide con “{busqueda}”.</p>}
                <div className="menu-rejilla">
                  {familias.map((f) => {
                    const abierta = q !== "" || expandidas.has(f.nombre);
                    return (
                      <section key={f.nombre} className="categoria" style={{ ["--cat" as string]: COLOR_FAMILIA }}>
                        <button type="button" className="categoria-cabecera" aria-expanded={abierta} onClick={() => alternarFamilia(f.nombre)}>
                          <span>{abierta ? "▾" : "▸"} {f.nombre}</span><span>{f.roles.length}</span>
                        </button>
                        {abierta && (
                          <div className="categoria-cuerpo">
                            {f.roles.map((p) => (
                              <button key={p.id} type="button" className="rol-opcion" disabled={cargando} onClick={() => elegirRol(p)}>
                                <span>{p.name}</span><span className="suave">{p.skills_count} skills</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="menu-cabecera">
                  <button type="button" onClick={() => { setRol(null); setMarcadas(new Set()); }}>← Roles</button>
                  <strong>{rol.name}</strong>
                  <span className="suave">{nombreFamilia(rol.family)}</span>
                  <button type="button" onClick={cerrar} aria-label="Cerrar">×</button>
                </div>
                <p className="suave">Elige las skills que quieres añadir. Las que ya están en el formulario aparecen rellenas y no se pueden quitar desde aquí.</p>
                <div className="rol-detalle">
                  {grupo("Skills core", rol.skills.filter((s) => s.is_primary))}
                  {grupo("Skills related", rol.skills.filter((s) => !s.is_primary))}
                </div>
                <div className="acciones">
                  <button type="button" className="primario" disabled={nuevas === 0} onClick={agregar}>
                    {nuevas === 0 ? "Añadir skills" : `Añadir ${nuevas} skill${nuevas === 1 ? "" : "s"}`}
                  </button>
                  <button type="button" onClick={() => { setRol(null); setMarcadas(new Set()); }}>Volver a los roles</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
