"use client";

// Portal Docente/Reclutador: catálogo SFIA, generación de ítems y banco de ítems.
import { useState } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { ItemBrowser } from "../shared/ItemBrowser";
import { LoginGate } from "../shared/LoginGate";
import { GenerateView } from "./GenerateView";

type Pestana = "banco" | "generar";

const SFIA_URL = "https://sfia-online.org/en/sfia-9"; // el catálogo SFIA se consulta en su sitio oficial

export function App() {
  const [pestana, setPestana] = useState<Pestana>("generar");
  const [version, setVersion] = useState(0); // sube cada vez que se generan ítems

  return (
    <LoginGate portal="docente" rol="teacher_recruiter" titulo="Portal Docente / Reclutador">
      {(me, salir) => (
        <>
          <header className="barra">
            <strong>Portal Docente / Reclutador</strong>
            <nav>
              <button className={pestana === "generar" ? "activa" : ""} onClick={() => setPestana("generar")}>Generar ítems</button>
              <button className={pestana === "banco" ? "activa" : ""} onClick={() => setPestana("banco")}>Banco de ítems</button>
              <a className="boton" href={SFIA_URL} target="_blank" rel="noreferrer">Catálogo SFIA ↗</a>
            </nav>
            <span>{me.name ?? me.email} <button onClick={salir}>Salir</button></span>
          </header>
          <main>
            {pestana === "generar" && <GenerateView alCrear={() => setVersion(version + 1)} />}
            {pestana === "banco" && (
              <ItemBrowser
                portal="docente"
                modo="docente"
                version={version}
                acciones={(item, recargar) => (
                  // HU-09: un ítem activo se puede usar sin validación de un experto.
                  <button
                    onClick={() =>
                      api("docente", `${CONTENT_URL}/items/${item.id}/status`, {
                        method: "PATCH",
                        body: { status: item.status === "active" ? "inactive" : "active" },
                      }).then(recargar)
                    }
                  >
                    {item.status === "active" ? "Desactivar ítem" : "Activar ítem"}
                  </button>
                )}
              />
            )}
          </main>
        </>
      )}
    </LoginGate>
  );
}
