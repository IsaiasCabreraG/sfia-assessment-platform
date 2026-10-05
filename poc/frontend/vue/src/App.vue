<script setup lang="ts">
import { ref } from "vue";
import Login from "./Login.vue";
import Panel from "./Panel.vue";
import { TOKEN_KEY } from "./config";

function tokenInicial(): string | null {
  // Con el login por redirección (authlib), el módulo devuelve el token en #access_token=...
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const recibido = hash.get("access_token");
  if (recibido) {
    localStorage.setItem(TOKEN_KEY, recibido);
    history.replaceState(null, "", window.location.pathname);
    return recibido;
  }
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

const token = ref<string | null>(tokenInicial());

function cerrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  token.value = null;
}
</script>

<template>
  <Login v-if="!token" @token="(nuevo) => (token = nuevo)" />
  <Panel v-else :token="token" @cerrar-sesion="cerrarSesion" />
</template>
