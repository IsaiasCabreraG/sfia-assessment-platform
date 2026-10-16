import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /api/* se reenvía al backend del prototipo (puerto 8003).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    proxy: { "/api": { target: "http://localhost:8003", rewrite: (p) => p.replace(/^\/api/, "") } },
  },
});
