"use client";

// Generación de ítems con IA (HU-04 y HU-06) en tres pasos, como el prototipo:
// 1. Qué evaluar (recuadros por skill) → 2. Contexto y resumen → 3. Revisión de borradores y publicación.
import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { colorDe } from "../shared/categorias";
import { CATALOG_URL, CONTENT_URL } from "../shared/config";
import { NOMBRE_TIPO } from "../shared/ItemDetail";
import type { Box, Draft, Level, RoleProfile, RoleProfileDetail, Skill } from "../shared/types";
import { ReviewView } from "./ReviewView";
import { ajustarContador, ResumenCompacto, StepEvaluar } from "./StepEvaluar";

type Paso = "evaluar" | "resumen" | "generando" | "revision" | "publicado";
interface Grupo { box: Box; tipo: string; cantidad: number; minutos: number }

// El trabajo sin publicar se guarda en el navegador: sobrevive a una recarga, a cerrar la pestaña o a volver a iniciar sesión.
const CLAVE_TRABAJO = "sprint1_borradores_docente";
const olvidarTrabajo = () => { try { localStorage.removeItem(CLAVE_TRABAJO); } catch {} };

const SIMULTANEAS = 3; // pedidos a la IA en paralelo (cada uno lanza un subproceso de la CLI)

export function GenerateView({ alCrear }: { alCrear: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [niveles, setNiveles] = useState<Level[]>([]);
  const [perfiles, setPerfiles] = useState<RoleProfile[]>([]);
  const [paso, setPaso] = useState<Paso>("evaluar");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fallos, setFallos] = useState<{ etiqueta: string; mensaje: string }[]>([]);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [publicadas, setPublicadas] = useState(0);
  const [error, setError] = useState("");
  const [restaurado, setRestaurado] = useState(false); // false hasta intentar recuperar (evita pisar lo guardado)
  const [recuperado, setRecuperado] = useState(false); // se recuperó trabajo de una sesión anterior

  // Al abrir la pantalla, recupera el trabajo que quedó sin publicar.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_TRABAJO);
      const d = guardado ? JSON.parse(guardado) : null;
      if (d && ((d.drafts?.length ?? 0) > 0 || (d.boxes?.length ?? 0) > 0)) {
        // Trabajo guardado antes de que el contexto fuera por skill: se completan los campos que faltan.
        const recuadros: Box[] = (d.boxes ?? []).map((b: Box) => ({ ...b, context: b.context ?? d.contexto ?? "" }));
        ajustarContador(recuadros);
        setBoxes(recuadros); setDrafts((d.drafts ?? []).map((x: Draft) => ({ ...x, context: x.context ?? d.contexto ?? "" }))); setFallos(d.fallos ?? []);
        setPaso(d.drafts?.length ? "revision" : d.paso === "resumen" || d.paso === "contexto" ? "resumen" : "evaluar");
        setRecuperado(true);
      }
    } catch { /* datos ilegibles: se empieza de cero */ }
    setRestaurado(true);
  }, []);

  // Guarda el trabajo cada vez que cambia.
  useEffect(() => {
    if (!restaurado || paso === "generando" || paso === "publicado") return;
    try {
      if (boxes.length === 0 && drafts.length === 0) olvidarTrabajo();
      else localStorage.setItem(CLAVE_TRABAJO, JSON.stringify({ paso, boxes, drafts, fallos }));
    } catch { /* sin espacio o sin acceso a localStorage: el trabajo sigue en pantalla */ }
  }, [restaurado, paso, boxes, drafts, fallos]);

  useEffect(() => {
    api<Skill[]>("docente", `${CATALOG_URL}/skills`).then(setSkills).catch((e) => setError(e.message));
    api<Level[]>("docente", `${CATALOG_URL}/levels`).then(setNiveles).catch(() => {});
    api<RoleProfile[]>("docente", `${CATALOG_URL}/role-profiles`).then(setPerfiles).catch(() => {});
  }, []);

  const cargarPerfil = (id: string) => api<RoleProfileDetail>("docente", `${CATALOG_URL}/role-profiles/${id}`);
  const etiquetaSkill = (id: string) => { const s = skills.find((x) => x.id === id); return s ? `${s.code} · ${s.name}` : id; };

  // Cada (recuadro, tipo) es un pedido a la IA.
  const grupos: Grupo[] = boxes.flatMap((box) =>
    Object.entries(box.types).filter(([, p]) => p.cantidad > 0).map(([tipo, p]) => ({ box, tipo, cantidad: p.cantidad, minutos: p.minutos })));
  // Si no se puede avanzar, se dice por qué: sin skills o con alguna skill sin ningún tipo de ítem marcado.
  const sinTipos = boxes.filter((b) => Object.keys(b.types).length === 0);
  const motivo = boxes.length === 0
    ? "Añade al menos una skill, o las skills de un rol."
    : sinTipos.length > 0
      ? `Marca al menos un tipo de ítem en: ${sinTipos.map((b) => skills.find((s) => s.id === b.skill_id)?.code ?? "una skill").join(", ")}.`
      : "";
  const puedeAvanzar = motivo === "";

  const pedir = async (g: Grupo): Promise<Draft[]> => {
    const r = await api<{ drafts: Record<string, any>[] }>("docente", `${CONTENT_URL}/drafts`, {
      method: "POST",
      body: { skill_id: g.box.skill_id, level: g.box.level, item_type: g.tipo, item_count: g.cantidad,
              estimated_minutes: g.minutos, context: g.box.context.trim() || null },
    });
    return r.drafts.map((content, i) => ({
      id: `${g.box.key}-${g.tipo}-${i}-${Date.now()}`, skill_id: g.box.skill_id, skill_label: etiquetaSkill(g.box.skill_id),
      skill_color: colorDe(skills.find((s) => s.id === g.box.skill_id)?.category ?? null), level: g.box.level, item_type: g.tipo, minutes: g.minutos, context: g.box.context.trim(), content, discarded: false,
    }));
  };

  const generar = async (lista: Grupo[], conservar: Draft[] = []) => {
    setPaso("generando"); setError("");
    setProgreso({ hechos: 0, total: lista.length });
    const porGrupo: Draft[][] = lista.map(() => []); // se ordena por grupo, no por quién termine primero
    const errores: { etiqueta: string; mensaje: string }[] = [];
    let siguiente = 0, hechos = 0;
    // Pequeño grupo de trabajadores que toman pedidos de la lista hasta agotarla.
    const trabajador = async () => {
      while (siguiente < lista.length) {
        const i = siguiente++;
        const g = lista[i];
        try { porGrupo[i] = await pedir(g); }
        catch (e) { errores.push({ etiqueta: `${etiquetaSkill(g.box.skill_id)} (${NOMBRE_TIPO[g.tipo]})`, mensaje: (e as Error).message }); }
        setProgreso({ hechos: ++hechos, total: lista.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, lista.length) }, trabajador));
    const nuevos = [...conservar, ...porGrupo.flat()];
    setDrafts(nuevos); setFallos(errores);
    if (nuevos.length === 0) { setError("La IA no devolvió borradores. " + errores.map((e) => e.mensaje).join(" | ")); setPaso("resumen"); }
    else setPaso("revision");
  };

  const reiniciar = () => { olvidarTrabajo(); setPaso("evaluar"); setBoxes([]); setDrafts([]); setFallos([]); setRecuperado(false); };

  const aviso = recuperado && (
    <p className="aviso">Recuperamos tu trabajo sin publicar. <button type="button" className="enlace" onClick={reiniciar}>Empezar de cero</button></p>
  );

  const vista = () => {
  if (paso === "publicado")
    return (
      <section className="formulario pagina">
        <h3>Publicación lista</h3>
        <p className="ok">Se publicaron {publicadas} pregunta(s). Ya están en el banco, activas y sin puntuar.</p>
        <button className="primario" onClick={reiniciar}>Generar más preguntas</button>
      </section>
    );

  if (paso === "generando")
    return (
      <section className="formulario pagina">
        <h3>Generando…</h3>
        <progress max={progreso.total} value={progreso.hechos} />
        <p className="suave">{progreso.hechos} de {progreso.total} pedidos a la IA (puede tardar un minuto por pedido).</p>
      </section>
    );

  if (paso === "revision")
    return (
      <ReviewView drafts={drafts} setDrafts={setDrafts} fallos={fallos}
                  alVolver={() => { setDrafts([]); setFallos([]); setPaso("resumen"); }}
                  alPublicar={(n) => { olvidarTrabajo(); setPublicadas(n); setPaso("publicado"); alCrear(); }} />
    );

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {paso === "evaluar" && (
        <>
          <StepEvaluar skills={skills} niveles={niveles} perfiles={perfiles} boxes={boxes} setBoxes={setBoxes} cargarPerfil={cargarPerfil} />
          <div className="acciones">
            <button className="primario" disabled={!puedeAvanzar} title={motivo || undefined} onClick={() => setPaso("resumen")}>Siguiente</button>
            {motivo && <span className="error" role="status">{motivo}</span>}
          </div>
        </>
      )}
      {paso === "resumen" && (
        <section className="formulario pagina">
          <h3>2. Resumen</h3>
          <ul className="resumen-lista">
            {boxes.map((b) => {
              const skill = skills.find((s) => s.id === b.skill_id);
              const color = colorDe(skill?.category ?? null);
              return (
                <li key={b.key} className="resumen-item" style={{ borderLeft: `6px solid ${color}` }}>
                  <ResumenCompacto b={b} skill={skill} color={color} conNombre />
                  <button type="button" className="enlace" onClick={() => setPaso("evaluar")}>cambiar</button>
                </li>
              );
            })}
          </ul>
          <div className="acciones">
            <button onClick={() => setPaso("evaluar")}>Atrás</button>
            <button className="primario" onClick={() => generar(grupos)}>Generar</button>
          </div>
        </section>
      )}
    </div>
  );
  };

  return <>{aviso}{vista()}</>;
}
