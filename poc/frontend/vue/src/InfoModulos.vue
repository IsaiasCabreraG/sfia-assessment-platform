<script setup lang="ts">
import { onMounted, ref } from "vue";
import { BACKEND_URL } from "./config";

interface Salud {
  modulo: string;
  variante: string | null;
  versiones?: Record<string, string>;
  comando?: string;
  cwd?: string;
  error?: string;
}

const filas = ref<Salud[] | null>(null);

function detalle(salud: Salud): string {
  const versiones = Object.entries(salud.versiones ?? {})
    .map(([paquete, version]) => `${paquete} ${version}`)
    .join(", ");
  const extras = [salud.comando && `comando: ${salud.comando}`, salud.cwd && `cwd: ${salud.cwd}`].filter(Boolean);
  return [versiones, ...extras].join(" · ");
}

async function leerJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Recuadro con la variante y las versiones de cada módulo que se está probando. */
async function consultar() {
  filas.value = null;
  // El frontend publica su propia identidad; la del resto la reúne el backend en GET /modulos.
  const [propio, restantes] = await Promise.all([
    leerJson<Salud>("/health.json"),
    leerJson<Salud[]>(`${BACKEND_URL}/modulos`),
  ]);
  filas.value = [
    propio ?? { modulo: "frontend", variante: null, error: "sin respuesta" },
    ...(restantes ?? [{ modulo: "backend", variante: null, error: "sin respuesta" }]),
  ];
}

onMounted(consultar);
</script>

<template>
  <section>
    <h2>Módulos bajo prueba</h2>
    <button @click="consultar">Actualizar</button>
    <table>
      <thead>
        <tr>
          <th>Módulo</th>
          <th>Variante</th>
          <th>Versiones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="filas === null">
          <td colspan="3">consultando…</td>
        </tr>
        <template v-else>
          <tr v-for="m in filas" :key="m.modulo">
            <td>{{ m.modulo }}</td>
            <td v-if="m.variante === null" colspan="2">{{ m.error ?? "sin respuesta" }} (¿no está corriendo?)</td>
            <template v-else>
              <td>{{ m.variante }}</td>
              <td>{{ detalle(m) }}</td>
            </template>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</template>
