"use client";

// Plantillas (HU-12): las mías y las públicas de otros docentes. Una plantilla pública con un ítem desactivado o no
// público queda «no disponible» (decisión momentánea, ver sprint-2.md). De una plantilla se crea un borrador, y las
// propias se pueden renombrar, cambiar de visibilidad o borrar.
import { useConfirmar } from "../shared/useConfirmar";
import { useCallback, useEffect, useState } from "react";
import { api } from "../shared/api";
import { BUILDER_URL } from "../shared/config";
import { ErrorCarga } from "../shared/EstadoCarga";
import { useVigencia } from "../shared/useVigencia";
import type { TemplateSummary } from "../shared/types";
import { DialogoPlantilla, type ItemDePlantilla } from "./DialogoPlantilla";

export function ListaPlantillas({ alUsar }: { alUsar: (evaluacionId: string) => void }) {
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [lista, setLista] = useState<TemplateSummary[] | null>(null);
  const [edicion, setEdicion] = useState<{ plantilla: TemplateSummary; items: ItemDePlantilla[] } | null>(null);
  const [error, setError] = useState("");

  const nueva = useVigencia();
  const cargar = useCallback(() => {
    const vigente = nueva();
    api<TemplateSummary[]>("docente", `${BUILDER_URL}/templates`)
      .then((r) => { if (vigente()) { setLista(r); setError(""); } })
      .catch((e) => { if (vigente()) setError(e.message); });
  }, [nueva]);
  useEffect(cargar, [cargar]);

  const usar = async (t: TemplateSummary) => {
    try {
      const nueva = await api<{ id: string }>("docente", `${BUILDER_URL}/templates/${t.id}/use`, { method: "POST", body: {} });
      alUsar(nueva.id);
    } catch (e) { setError((e as Error).message); }
  };

  const editar = async (t: TemplateSummary) => {
    try {
      const d = await api<{ items: ItemDePlantilla[] }>("docente", `${BUILDER_URL}/templates/${t.id}`);
      setEdicion({ plantilla: t, items: d.items });
    } catch (e) { setError((e as Error).message); }
  };

  const borrar = async (t: TemplateSummary) => {
    if (!await confirmar(`¿Borrar la plantilla «${t.name}»? Las evaluaciones creadas desde ella no cambian.`)) return;
    try { await api("docente", `${BUILDER_URL}/templates/${t.id}`, { method: "DELETE" }); cargar(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <section>
      {dialogoConfirmar}
      <h2 className="mb-5">Plantillas</h2>
      {error && lista !== null && <p className="error">{error}</p>}
      {lista === null ? (error ? <ErrorCarga mensaje={error} alReintentar={() => { setError(""); cargar(); }} /> : <p className="suave">Cargando…</p>) : lista.length === 0 ? (
        <p className="suave">No hay plantillas. Se crean con «Guardar como plantilla» desde una evaluación.</p>
      ) : (
        <table className="tabla-eval">
          <thead><tr><th>Nombre</th><th>Dueño</th><th>Visibilidad</th><th>Estado</th><th>Ítems</th><th /></tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.mine ? "yo" : t.owner_name ?? "otro docente"}</td>
                <td><span className="etiqueta">{t.visibility === "public" ? "pública" : "privada"}</span></td>
                <td>
                  <span className={`etiqueta ${t.available ? "ok-et" : "aviso-et"}`}>{t.available ? "disponible" : "no disponible"}</span>
                  {!t.available && t.blocked_items && <div className="suave">{t.blocked_items.map((b) => `${b.skill_code}: ${b.reason}`).join(", ")}</div>}
                </td>
                <td>{t.items_count}</td>
                <td className="acciones">
                  <button disabled={!t.available} onClick={() => usar(t)}>Usar</button>
                  {t.mine && <button onClick={() => editar(t)}>Editar</button>}
                  {t.mine && <button className="peligro" onClick={() => borrar(t)}>Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edicion && (
        <DialogoPlantilla titulo="Editar plantilla" nombreInicial={edicion.plantilla.name} visibilidadInicial={edicion.plantilla.visibility}
          items={edicion.items} textoGuardar="Guardar cambios" alCerrar={() => setEdicion(null)}
          alGuardar={async (nombre, visibilidad, hacerPublicos) => {
            await api("docente", `${BUILDER_URL}/templates/${edicion.plantilla.id}`, {
              method: "PUT", body: { name: nombre, visibility: visibilidad, make_items_public: hacerPublicos } });
            cargar();
          }} />
      )}
    </section>
  );
}
