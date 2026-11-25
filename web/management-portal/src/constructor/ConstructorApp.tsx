"use client";

// Constructor de evaluaciones (HU-11, HU-12 y HU-38): mis evaluaciones y el asistente de tres pasos para armarlas, las
// plantillas y mis roles propios.
import { useState } from "react";
import { EditorEvaluacion } from "./EditorEvaluacion";
import { ListaEvaluaciones } from "./ListaEvaluaciones";
import { ListaPlantillas } from "./ListaPlantillas";
import { ListaRoles } from "./ListaRoles";

type Pestana = "evaluaciones" | "plantillas" | "roles";
type Vista = { tipo: "lista" } | { tipo: "editor"; id: string | null };
const PESTANAS: [Pestana, string][] = [["evaluaciones", "Evaluaciones"], ["plantillas", "Plantillas"], ["roles", "Mis roles"]];

export function ConstructorApp() {
  const [pestana, setPestana] = useState<Pestana>("evaluaciones");
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const enEditor = pestana === "evaluaciones" && vista.tipo === "editor";
  const abrir = (id: string | null) => { setPestana("evaluaciones"); setVista({ tipo: "editor", id }); };

  return (
    <div>
      {!enEditor && (
        <div className="acciones" role="tablist" aria-label="Constructor">
          {PESTANAS.map(([p, texto]) => (
            <button key={p} role="tab" aria-selected={pestana === p} className={pestana === p ? "activa" : ""} onClick={() => { setPestana(p); setVista({ tipo: "lista" }); }}>{texto}</button>
          ))}
        </div>
      )}
      {pestana === "evaluaciones" && (vista.tipo === "lista"
        ? <ListaEvaluaciones alAbrir={abrir} />
        : <EditorEvaluacion key={vista.id ?? "nueva"} id={vista.id} alSalir={() => setVista({ tipo: "lista" })} alAbrir={abrir} />)}
      {pestana === "plantillas" && <ListaPlantillas alUsar={abrir} />}
      {pestana === "roles" && <ListaRoles />}
    </div>
  );
}
