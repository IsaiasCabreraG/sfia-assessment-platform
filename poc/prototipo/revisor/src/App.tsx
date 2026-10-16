import { useEffect, useState } from "react";
import Lista from "./Lista";
import Pregunta from "./Pregunta";

// Navegación mínima por hash: "#/" es la lista y "#/pregunta/<id>" la página de una pregunta.
function leerRuta(): string | null {
  const m = window.location.hash.match(/^#\/pregunta\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const [id, setId] = useState<string | null>(leerRuta);

  useEffect(() => {
    const alCambiar = () => setId(leerRuta());
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  return (
    <main>
      {id ? <Pregunta id={id} /> : <Lista />}
    </main>
  );
}
