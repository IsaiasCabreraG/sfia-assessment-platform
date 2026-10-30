import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = { title: "Plataforma SFIA - Sprint 1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
