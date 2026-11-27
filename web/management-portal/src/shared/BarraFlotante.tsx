// Barra de navegación (Volver, Siguiente, Publicar…) que flota sobre la página en el mismo lugar y no sale de pantalla.
import type { ReactNode } from "react";

export function BarraFlotante({ children }: { children: ReactNode }) {
  return <div className="barra-flotante" role="toolbar" aria-label="Navegación"><div className="barra-flotante-cuerpo">{children}</div></div>;
}
