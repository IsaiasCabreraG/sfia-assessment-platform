"use client";

// Resumen de una evaluación: cada skill con los niveles que se evaluarán y cuántos ítems lleva.
import type { EvaluationDetail } from "../shared/types";

export function ResumenSkills({ detalle }: { detalle: EvaluationDetail }) {
  return (
    <>
      <table className="tabla-eval">
        <thead><tr><th>Skill</th><th>Niveles</th><th>Ítems</th></tr></thead>
        <tbody>
          {detalle.skills.map((s) => (
            <tr key={s.id}><td><strong>{s.code}</strong> <span className="suave">{s.name}</span></td><td>{s.min_level} a {s.max_level}</td><td>{s.items_count}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: ".5rem 0 0" }}>
        <strong>Ítems:</strong> {detalle.items.length}
        {detalle.role_profile && <span className="suave"> · rol de base: {detalle.role_profile.name}{detalle.role_customized ? " (rol personalizado)" : ""}</span>}
      </p>
    </>
  );
}
