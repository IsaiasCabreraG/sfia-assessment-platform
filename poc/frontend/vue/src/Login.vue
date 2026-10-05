<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import InfoModulos from "./InfoModulos.vue";
import { AUTH_URL, BACKEND_URL, TOKEN_KEY } from "./config";

const emit = defineEmits<{ token: [valor: string] }>();

type Estado = "detectando" | "sin-backend" | "sin-auth" | "listo";

/** Datos del módulo de autenticación activo, tal como los informa su /health (vía GET /modulos del backend). */
interface Autenticacion {
  variante: string;
  google_client_id?: string;
}

declare global {
  interface Window {
    // Script de Google Identity Services (se carga si el módulo de autenticación activo es google-auth).
    google?: any;
  }
}

const estado = ref<Estado>("detectando");
const auth = ref<Autenticacion | null>(null);
const error = ref("");
const scriptCargado = ref(false);
const botonGoogle = ref<HTMLDivElement | null>(null);
const origen = window.location.origin;
const esLocalhost = window.location.hostname === "localhost";

/** Averigua qué módulo de autenticación está corriendo; el botón de login depende de eso. */
async function detectar() {
  error.value = "";
  auth.value = null;
  estado.value = "detectando";
  try {
    const r = await fetch(`${BACKEND_URL}/modulos`);
    if (!r.ok) {
      estado.value = "sin-backend";
      return;
    }
    const modulos = (await r.json()) as { modulo: string; variante: string | null; google_client_id?: string }[];
    const detectada = modulos.find((m) => m.modulo === "auth");
    if (!detectada || !detectada.variante) {
      estado.value = "sin-auth";
      return;
    }
    auth.value = { variante: detectada.variante, google_client_id: detectada.google_client_id };
    estado.value = "listo";
  } catch {
    estado.value = "sin-backend";
  }
}

onMounted(detectar);

function irAlLogin() {
  window.location.href = `${AUTH_URL}/auth/login`;
}

// Botón de Google: solo si el módulo de autenticación activo es google-auth.
watch(auth, (actual, _anterior, alLimpiar) => {
  if (!actual || actual.variante !== "google-auth") return;
  const clienteId = actual.google_client_id;
  if (!clienteId) {
    error.value = "El módulo google-auth no informó su ID de cliente de Google.";
    return;
  }
  scriptCargado.value = false;
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onerror = () => {
    error.value = "No se pudo cargar el script de Google (¿sin conexión o bloqueado?).";
  };
  script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: clienteId,
      callback: async (respuesta: { credential: string }) => {
        let r: Response;
        try {
          r = await fetch(`${AUTH_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: respuesta.credential }),
          });
        } catch {
          error.value = `No se pudo contactar al módulo de autenticación en ${AUTH_URL}.`;
          return;
        }
        if (!r.ok) {
          error.value = `El módulo de autenticación respondió ${r.status}.`;
          return;
        }
        const { access_token } = await r.json();
        localStorage.setItem(TOKEN_KEY, access_token);
        emit("token", access_token);
      },
    });
    window.google.accounts.id.renderButton(botonGoogle.value, { theme: "outline", size: "large" });
    scriptCargado.value = true;
  };
  document.head.appendChild(script);
  alLimpiar(() => script.remove());
});
</script>

<template>
  <main>
    <h1>PoC - Frontend (Vue)</h1>
    <p>Inicia sesión para continuar.</p>
    <p v-if="auth">
      Módulo de autenticación detectado: <strong>{{ auth.variante }}</strong>
    </p>

    <p v-if="estado === 'detectando'">Detectando el módulo de autenticación…</p>
    <p v-else-if="estado === 'sin-backend'" class="error">
      No se pudo consultar al backend en {{ BACKEND_URL }} para detectar la autenticación (¿está corriendo?).
      <template v-if="!esLocalhost">
        Estás abriendo la página en {{ origen }}: ábrela en http://localhost:5173, que es el origen autorizado por
        el backend y por Google.
      </template>
    </p>
    <p v-else-if="estado === 'sin-auth'" class="error">
      El módulo de autenticación no responde (¿está corriendo en {{ AUTH_URL }}?).
    </p>
    <button v-else-if="auth?.variante === 'authlib'" @click="irAlLogin">
      Iniciar sesión con Google
    </button>
    <template v-else-if="auth?.variante === 'google-auth'">
      <div ref="botonGoogle"></div>
      <p v-if="!scriptCargado && !error">Cargando el botón de Google…</p>
      <p v-if="scriptCargado">
        Si Google rechaza el acceso al pulsar el botón, comprueba que <code>{{ origen }}</code> esté en «Orígenes
        autorizados de JavaScript» del cliente OAuth (Google Cloud Console).
      </p>
    </template>
    <p v-else class="error">Variante de autenticación no soportada: {{ auth?.variante }}.</p>

    <button v-if="estado === 'sin-backend' || estado === 'sin-auth'" @click="detectar">Reintentar</button>
    <p v-if="error" class="error">{{ error }}</p>
    <InfoModulos />
  </main>
</template>
