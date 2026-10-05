import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  // Las pruebas comparten usuario y datos: se ejecutan una tras otra.
  workers: 1,
  reporter: "list",
  use: {
    // Frontend a probar (React o Vue): el mismo test sirve para ambos.
    baseURL: process.env.FRONTEND_URL ?? "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
