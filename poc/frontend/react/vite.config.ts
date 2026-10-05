import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

function versionDe(paquete: string): string {
  const ruta = resolve(process.cwd(), "node_modules", paquete, "package.json");
  return JSON.parse(readFileSync(ruta, "utf-8")).version;
}

// Publica /health.json con la variante y las versiones, para que poc/tests/smoke_test.py identifique el frontend.
function health(): Plugin {
  return {
    name: "poc-health",
    configureServer(server) {
      server.middlewares.use("/health.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            modulo: "frontend",
            variante: "react",
            versiones: {
              node: process.versions.node,
              react: versionDe("react"),
              vite: versionDe("vite"),
            },
          }),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), health()],
  server: { host: "localhost" },
});
