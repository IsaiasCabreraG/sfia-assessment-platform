import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next", // carpeta de build alternativa para correr dos servidores a la vez
  // El portal importa config/criterios-fijos.json, que está en la raíz del proyecto (fuera de esta carpeta) y
  // también lee el backend; Next solo deja importar archivos que estén dentro de su raíz.
  turbopack: { root: path.join(__dirname, "../..") },
  // Las URLs terminan en "/" (/docente/, /validador/): así coinciden con PORTAL_*_URL del backend
  // y el fragmento #access_token no se pierde en una redirección.
  trailingSlash: true,
};

export default config;
