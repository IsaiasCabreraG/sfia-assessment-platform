import Link from "next/link";

// Inicio: enlaces a los dos portales.
export default function Inicio() {
  return (
    <main className="acceso">
      <h1>Plataforma SFIA</h1>
      <p>Elige tu portal</p>
      <p><Link href="/docente/">Portal Docente / Reclutador</Link></p>
      <p><Link href="/validador/">Portal Validador</Link></p>
    </main>
  );
}
