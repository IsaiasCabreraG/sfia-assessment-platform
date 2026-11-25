"use client";

// HU-05: el validador puntúa un ítem de 1 (malo) a 5 (bueno) estrellas enteras.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { SelectorEstrellas } from "../shared/Estrellas";
import type { ItemDetailData } from "../shared/types";

export function ScoreForm({ item, alPuntuar }: { item: ItemDetailData; alPuntuar: () => void }) {
  const [valor, setValor] = useState<number | null>(item.my_score);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Al cambiar de ítem, se muestra su puntuación propia (o vacío si aún no la puso).
  useEffect(() => { setValor(item.my_score); setOk(false); setError(""); }, [item.id, item.my_score]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (valor === null) return;
    try {
      await api("validador", `${CONTENT_URL}/items/${item.id}/score`, { method: "PUT", body: { score: valor } });
      setOk(true); setError("");
      alPuntuar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <h4>Tu puntuación</h4>
      <p className="suave">1 estrella = ítem malo · 3 = calidad media · 5 = ítem bueno</p>
      <SelectorEstrellas valor={valor} alElegir={(n) => { setValor(n); setOk(false); }} />
      <button className="primario" disabled={valor === null}>{item.my_score === null ? "Puntuar" : "Actualizar puntuación"}</button>
      {ok && <p className="ok">Puntuación guardada.</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
