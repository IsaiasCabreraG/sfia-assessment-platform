"use client";

// Menú "+ Añadir skill": ventana con las skills agrupadas por categoría y subcategoría, estilo Figura 2.
// Cada skill muestra su código, nombre y los niveles SFIA en que está definida.
import { useEffect, useMemo, useState } from "react";
import type { Skill } from "./types";
import { agruparSkills } from "./categorias";
import { Niveles } from "./Niveles";

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** `texto` es lo que dice el botón (por defecto "+ Añadir skill…"); sirve también para cambiar la skill de un recuadro. */
export function SkillPicker({ skills, alElegir, texto = "+ Añadir skill…", alLimpiar, textoLimpiar = "Todas las skills" }:
  { skills: Skill[]; alElegir: (skillId: string) => void; texto?: string; alLimpiar?: () => void; textoLimpiar?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const q = normalizar(busqueda.trim());
  const grupos = useMemo(
    () => agruparSkills(q ? skills.filter((s) => normalizar(`${s.code} ${s.name}`).includes(q)) : skills),
    [skills, q]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const alternar = (cat: string) => setExpandidas((prev) => { const n = new Set(prev); if (!n.delete(cat)) n.add(cat); return n; });
  const elegir = (id: string) => { alElegir(id); setAbierto(false); setBusqueda(""); };
  const cerrar = () => { setAbierto(false); setBusqueda(""); };
  const limpiar = () => { alLimpiar?.(); cerrar(); };

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>{texto}</button>
      {abierto && (
        <div className="menu-fondo" onClick={cerrar}>
          <div className="menu-skills" role="dialog" aria-label="Añadir skill" onClick={(e) => e.stopPropagation()}>
            <div className="menu-cabecera">
              <strong>Elige una skill</strong>
              <input type="search" className="menu-busqueda" autoFocus placeholder="Buscar por código o nombre…" aria-label="Buscar skill"
                     value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              <button type="button" onClick={cerrar} aria-label="Cerrar">×</button>
            </div>
            {alLimpiar && <button type="button" className="skill-todas" onClick={limpiar}>{textoLimpiar}</button>}
            <p className="suave">Niveles de responsabilidad SFIA: 1 Follow → 7 Set strategy</p>
            {grupos.length === 0 && <p className="suave">Ninguna skill coincide con “{busqueda}”.</p>}
            <div className="menu-rejilla">
              {grupos.map((g) => {
                const abierta = q !== "" || expandidas.has(g.categoria);
                return (
                  <section key={g.categoria} className="categoria" style={{ ["--cat" as string]: g.color }}>
                    <button type="button" className="categoria-cabecera" aria-expanded={abierta} onClick={() => alternar(g.categoria)}>
                      <span>{abierta ? "▾" : "▸"} {g.categoria}</span><span>{g.total}</span>
                    </button>
                    {abierta && (
                      <div className="categoria-cuerpo">
                        {g.subcategorias.map((sub) => (
                          <div key={sub.nombre} className="subcategoria">
                            <h4>{sub.nombre}</h4>
                            {sub.skills.map((s) => (
                              <button key={s.id} type="button" className="skill-opcion" onClick={() => elegir(s.id)}>
                                <span className="codigo">{s.code}</span>
                                <span className="nombre">{s.name}</span>
                                <Niveles min={s.min_level} max={s.max_level} color={g.color} />
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
