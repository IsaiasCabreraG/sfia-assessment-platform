import type { Bloque, Borrador, Catalogo, Formulario, Rol } from "./tipos";

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

export const obtenerCatalogo = () => pedir<Catalogo>("/skills");

export const guardarRol = (nombre: string, bloques: Bloque[]) =>
  pedir<{ rol: Rol }>("/roles", {
    nombre,
    skills: bloques.map((b) => ({ codigo: b.codigo, nivel: b.nivel, tipos: b.tipos, dificultad: b.dificultad, tiempo_min: b.tiempo_min })),
  }).then((r) => r.rol);

export const generar = (f: Formulario) =>
  pedir<{ borradores: Borrador[] }>("/generate", f).then((r) => r.borradores);

export const regenerar = (formulario: Formulario, borrador: Borrador, feedback: string) =>
  pedir<{ borrador: Borrador }>("/regenerate", { formulario, borrador, feedback }).then((r) => r.borrador);

export const publicar = (borradores: Borrador[], disponible_expertos: boolean) =>
  pedir<{ publicados: number }>("/publish", { borradores, disponible_expertos });

// Los archivos se leen como texto en el navegador; el backend los pega en el prompt.
export async function leerArchivos(lista: FileList | null) {
  const salida: { nombre: string; contenido: string }[] = [];
  for (const f of Array.from(lista ?? [])) {
    if (f.size > 200_000) throw new Error(`${f.name}: supera 200 KB`);
    salida.push({ nombre: f.name, contenido: await f.text() });
  }
  return salida;
}
