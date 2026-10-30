"use client";

// Pantalla de acceso de un portal. Autenticación (Google) y autorización (rol en la lista blanca) son
// pasos distintos: cualquiera puede iniciar sesión, pero solo ve el portal quien tiene el rol.
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { cerrarSesion, guardarTokenDeLaUrl, iniciarLogin, leerAvisoSesionVencida, leerToken, refrescarSesion, rolesDelToken, type Portal } from "./auth";
import { IDENTITY_URL } from "./config";
import type { Me } from "./types";

type Estado = "cargando" | "sin-sesion" | "no-autorizado" | "sesion-vieja" | "ok";

interface Props {
  portal: Portal;
  rol: string; // rol que da acceso a este portal
  titulo: string;
  children: (me: Me, salir: () => void) => ReactNode;
}

export function LoginGate({ portal, rol, titulo, children }: Props) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [me, setMe] = useState<Me | null>(null);
  const [venció, setVenció] = useState(false);

  useEffect(() => {
    guardarTokenDeLaUrl(portal); // si volvemos de Google, guarda el JWT antes de leerlo
    const token = leerToken(portal);
    if (!token) {
      if (leerAvisoSesionVencida(portal)) setVenció(true); // solo enciende: en desarrollo el efecto corre dos veces
      return setEstado("sin-sesion");
    }
    // /auth/me devuelve los roles vigentes en la BD; el JWT puede traer roles anteriores.
    api<Me>(portal, `${IDENTITY_URL}/auth/me`)
      .then((datos) => {
        setMe(datos);
        if (!datos.roles.includes(rol)) setEstado("no-autorizado");
        else if (!rolesDelToken(leerToken(portal) ?? "").includes(rol)) {
          // Autorizado después de iniciar sesión: al renovar la sesión el token trae los roles nuevos.
          refrescarSesion(portal).then((r) => setEstado(r === "ok" ? "ok" : "sesion-vieja"));
        } else setEstado("ok");
      })
      .catch(() => {
        cerrarSesion(portal); // token vencido o inválido
        setEstado("sin-sesion");
      });
  }, [portal, rol]);

  const salir = () => {
    cerrarSesion(portal);
    window.location.reload();
  };

  if (estado === "cargando") return <p className="centro">Cargando…</p>;
  if (estado === "ok" && me) return <>{children(me, salir)}</>;

  return (
    <main className="acceso">
      <h1>{titulo}</h1>
      {estado === "sin-sesion" && (
        <>
          {venció && <p className="error">Tu sesión venció. El trabajo que tenías sin publicar se conserva en este navegador.</p>}
          <p>Inicia sesión con tu cuenta de Google para continuar.</p>
          <button className="primario" onClick={() => iniciarLogin(portal)}>
            Iniciar sesión con Google
          </button>
        </>
      )}
      {estado === "no-autorizado" && (
        <>
          <p className="error">Tu cuenta ({me?.email}) no está autorizada para este portal.</p>
          <button onClick={salir}>Cerrar sesión</button>
        </>
      )}
      {estado === "sesion-vieja" && (
        <>
          <p>Tu cuenta fue autorizada después de iniciar esta sesión. Vuelve a entrar para actualizarla.</p>
          <button className="primario" onClick={() => iniciarLogin(portal)}>
            Volver a iniciar sesión
          </button>
        </>
      )}
    </main>
  );
}
