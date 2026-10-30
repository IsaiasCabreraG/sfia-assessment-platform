"use client";

// HU-05: el validador puntúa un ítem de 0.0 (malo) a 5.0 (bueno), con un decimal.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import type { ItemDetailData } from "../shared/types";

export function ScoreForm({ item, alPuntuar }: { item: ItemDetailData; alPuntuar: () => void }) {
  const [valor, setValor] = useState<string>(item.my_score === null ? "" : String(item.my_score));
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Al cambiar de ítem, se muestra su puntuación propia (o vacío si aún no la puso).
  useEffect(() => { setValor(item.my_score === null ? "" : String(item.my_score)); setOk(false); setError(""); }, [item.id, item.my_score]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("validador", `${CONTENT_URL}/items/${item.id}/score`, { method: "PUT", body: { score: Number(valor) } });
      setOk(true); setError("");
      alPuntuar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <h4>Tu puntuación</h4>
      <p className="suave">0.0 = ítem malo · 2.5 = calidad media · 5.0 = ítem bueno</p>
      <input type="number" min="0" max="5" step="0.1" required value={valor} onChange={(e) => setValor(e.target.value)} />
      <button className="primario">{item.my_score === null ? "Puntuar" : "Actualizar puntuación"}</button>
      {ok && <p className="ok">Puntuación guardada.</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
