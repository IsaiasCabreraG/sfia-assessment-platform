// URLs de los módulos del backend (se pueden cambiar con variables VITE_* en web/.env).
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:8001";
export const CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "http://localhost:8002";
export const CONTENT_URL = process.env.NEXT_PUBLIC_CONTENT_URL ?? "http://localhost:8004";
