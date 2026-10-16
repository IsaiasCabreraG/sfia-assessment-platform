import type { Item, ItemDetalle } from "./tipos";

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`/api${ruta}`, {
    method: cuerpo ? "POST" : "GET",
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail ?? `Error ${r.status}`);
  }
  return r.json();
}

export const listarItems = () => pedir<{ items: Item[] }>("/items").then((r) => r.items);
export const obtenerItem = (id: string) => pedir<{ item: ItemDetalle }>(`/items/${id}`).then((r) => r.item);
export const revisarItem = (id: string, decision: "aprobada" | "rechazada", motivo = "") =>
  pedir<{ item: ItemDetalle }>(`/items/${id}/revision`, { decision, motivo }).then((r) => r.item);
