"use client";

// Texto con una explicación o un ejemplo que aparece al pasar el cursor (o al enfocarlo con el teclado) por encima.
// Se reconoce por el subrayado de puntos (HU-06-2).
import type { ReactNode } from "react";

export function Ayuda({ texto, children }: { texto: string; children: ReactNode }) {
  return <span className="ayuda" tabIndex={0} aria-description={texto} data-texto={texto}>{children}</span>;
}
