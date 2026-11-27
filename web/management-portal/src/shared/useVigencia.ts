// Evita que una respuesta lenta pise a una más nueva (o llegue tras desmontar el componente).
// Uso: `const vigente = nueva();` al empezar la llamada y `if (vigente()) setX(...)` al recibir la respuesta.
import { useCallback, useEffect, useRef } from "react";

export function useVigencia() {
  const contador = useRef(0);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  return useCallback(() => {
    const mia = ++contador.current;
    return () => montado.current && contador.current === mia;
  }, []);
}
