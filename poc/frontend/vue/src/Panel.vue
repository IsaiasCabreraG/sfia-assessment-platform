<script setup lang="ts">
import { onMounted, ref } from "vue";
import InfoModulos from "./InfoModulos.vue";
import { BACKEND_URL } from "./config";

const props = defineProps<{ token: string }>();
const emit = defineEmits<{ cerrarSesion: [] }>();

interface Item {
  id: number;
  titulo: string;
  descripcion: string | null;
  creado_por: string;
  creado_en: string;
}

const items = ref<Item[]>([]);
const errorTabla = ref("");
const titulo = ref("");
const descripcion = ref("");
const errorForm = ref("");
const consulta = ref("");
const respuesta = ref("");
const errorIA = ref("");
const consultando = ref(false);

/** Nombre del usuario, leído del JWT solo para mostrarlo (la verificación la hace el backend). */
function nombreDelToken(token: string): string {
  try {
    const cuerpo = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(cuerpo), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).nombre ?? "usuario";
  } catch {
    return "usuario";
  }
}

/** Llama al backend con el JWT; si responde 401, cierra la sesión. */
async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${BACKEND_URL}${ruta}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${props.token}`,
    },
  });
  if (r.status === 401) {
    emit("cerrarSesion");
    throw new Error("La sesión expiró");
  }
  if (!r.ok) {
    throw new Error(`El backend respondió ${r.status}`);
  }
  return r.json();
}

async function cargarItems() {
  try {
    items.value = await api<Item[]>("/items");
    errorTabla.value = "";
  } catch (e) {
    errorTabla.value = (e as Error).message;
  }
}

onMounted(cargarItems);

async function crearItem() {
  try {
    await api("/items", {
      method: "POST",
      body: JSON.stringify({ titulo: titulo.value, descripcion: descripcion.value || null }),
    });
    titulo.value = "";
    descripcion.value = "";
    errorForm.value = "";
    await cargarItems();
  } catch (e) {
    errorForm.value = (e as Error).message;
  }
}

async function preguntar() {
  consultando.value = true;
  respuesta.value = "";
  try {
    const { answer } = await api<{ answer: string }>("/ai/ask", {
      method: "POST",
      body: JSON.stringify({ prompt: consulta.value }),
    });
    respuesta.value = answer;
    errorIA.value = "";
  } catch (e) {
    errorIA.value = (e as Error).message;
  } finally {
    consultando.value = false;
  }
}
</script>

<template>
  <main>
    <header>
      <h1>PoC - Frontend (Vue)</h1>
      <span>
        {{ nombreDelToken(token) }} <button @click="emit('cerrarSesion')">Cerrar sesión</button>
      </span>
    </header>

    <section>
      <h2>Ítems</h2>
      <button @click="cargarItems">Actualizar</button>
      <p v-if="errorTabla" class="error">{{ errorTabla }}</p>
      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Título</th>
            <th>Descripción</th>
            <th>Creado por</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in items" :key="i.id">
            <td>{{ i.id }}</td>
            <td>{{ i.titulo }}</td>
            <td>{{ i.descripcion }}</td>
            <td>{{ i.creado_por }}</td>
            <td>{{ new Date(i.creado_en).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Nuevo ítem</h2>
      <form @submit.prevent="crearItem">
        <input v-model="titulo" placeholder="Título" required />
        <input v-model="descripcion" placeholder="Descripción" />
        <button type="submit">Guardar</button>
      </form>
      <p v-if="errorForm" class="error">{{ errorForm }}</p>
    </section>

    <section>
      <h2>Consulta a la IA</h2>
      <form @submit.prevent="preguntar">
        <textarea v-model="consulta" placeholder="Escribe tu consulta" rows="3" required></textarea>
        <button type="submit" :disabled="consultando">
          {{ consultando ? "Consultando… (puede tardar unos segundos)" : "Preguntar" }}
        </button>
      </form>
      <p v-if="errorIA" class="error">{{ errorIA }}</p>
      <p v-if="respuesta" class="respuesta">{{ respuesta }}</p>
    </section>

    <InfoModulos />
  </main>
</template>
