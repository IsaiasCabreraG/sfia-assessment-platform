"use client";

// Menú "+ Añadir skill": ventana con las skills agrupadas por categoría y subcategoría, estilo Figura 2.
// Cada skill muestra su código, nombre y los niveles SFIA en que está definida.
import { Modal } from "./Modal";
import { useEffect, useMemo, useState } from "react";
import type { Skill } from "./types";
import type { Portal } from "./auth";
import { agruparSkills, colorDe } from "./categorias";
import { FichaSkill, titulosDeNiveles, useNiveles } from "./DescripcionSkill";
import { Niveles } from "./Niveles";

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** `texto` es lo que dice el botón (por defecto «Añadir una skill»); sirve también para cambiar la skill de un recuadro. */
export function SkillPicker({ skills, alElegir, texto = "Añadir una skill", alLimpiar, textoLimpiar = "Todas las skills", portal = "docente" }:
  { skills: Skill[]; alElegir: (skillId: string) => void; texto?: string; alLimpiar?: () => void; textoLimpiar?: string; portal?: Portal }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [foco, setFoco] = useState<string | null>(null); // skill cuya descripción se ve a la derecha
  const q = normalizar(busqueda.trim());
  const titulos = titulosDeNiveles(useNiveles(portal));
  const grupos = useMemo(
    () => agruparSkills(q ? skills.filter((s) => normalizar(`${s.code} ${s.name}`).includes(q)) : skills),
    [skills, q]);

  const alternar = (cat: string) => setExpandidas((prev) => { const n = new Set(prev); if (!n.delete(cat)) n.add(cat); return n; });
  const cerrar = () => { setAbierto(false); setBusqueda(""); setFoco(null); };
  const elegir = (id: string) => { alElegir(id); cerrar(); };
  const limpiar = () => { alLimpiar?.(); cerrar(); };
  const fichaSkill = skills.find((s) => s.id === foco) ?? null;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>{texto}</button>
      {abierto && (
        <Modal etiqueta="Añadir skill" alCerrar={cerrar} encabezado={
          <div className="menu-cabecera">
            <strong>Elige una skill</strong>
            <input type="search" className="menu-busqueda" autoFocus placeholder="Buscar por código o nombre…" aria-label="Buscar skill"
                   value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>}>
          {alLimpiar && <button type="button" className="skill-todas" onClick={limpiar}>{textoLimpiar}</button>}
          {grupos.length === 0 && <p className="suave">Ninguna skill coincide con “{busqueda}”.</p>}
          <div className="rol-con-ficha skill-con-ficha">
            <div className="menu-rejilla dos">
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
                              <button key={s.id} type="button" className="skill-opcion" onClick={() => elegir(s.id)}
                                      onMouseEnter={() => setFoco(s.id)} onFocus={() => setFoco(s.id)}>
                                <span className="codigo">{s.code}</span>
                                <span className="nombre">{s.name}</span>
                                <Niveles min={s.min_level} max={s.max_level} color={g.color} titulos={titulos} />
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
            <aside className="rol-ficha" aria-label="Descripción de la skill">
              {fichaSkill ? <FichaSkill skill={fichaSkill} color={colorDe(fichaSkill.category)} portal={portal} />
                : <p className="suave">Pasa el cursor por una skill para ver su descripción.</p>}
            </aside>
          </div>
        </Modal>
      )}
    </>
  );
}
