"use client";

// Icono de un tipo de ítem (HU-37): su forma y su color identifican el tipo sin leer su nombre.
import { Icono } from "./Estrellas";
import { NOMBRE_TIPO } from "./tipos";

export const COLOR_TIPO: Record<string, string> = {
  single_choice: "#1f5fbf",
  true_false: "#0e8a8a",
  open_question: "#7a4bb5",
  coding: "#b8860b",
  system_design: "#b22222",
  debugging: "#8b4513",
};

/** `decorativo`: sin título, para usarlo junto al nombre del tipo (que ya lo dice) sin repetirlo. */
export function IconoTipo({ tipo, decorativo = false }: { tipo: string; decorativo?: boolean }) {
  return (
    <span className="icono-tipo" style={{ color: COLOR_TIPO[tipo] }}>
      <Icono nombre={`tipo-${tipo}`} titulo={decorativo ? undefined : NOMBRE_TIPO[tipo] ?? tipo} />
    </span>
  );
}
