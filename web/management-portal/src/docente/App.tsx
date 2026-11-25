"use client";

// Portal Docente/Reclutador: catálogo SFIA, generación de ítems y banco de ítems.
import { useState } from "react";
import { ItemBrowser } from "../shared/ItemBrowser";
import { LoginGate } from "../shared/LoginGate";
import { ConstructorApp } from "../constructor/ConstructorApp";
import { AccionesItem } from "./AccionesItem";
import { GenerateView } from "./GenerateView";

type Pestana = "banco" | "generar" | "constructor";

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
              <button className={pestana === "constructor" ? "activa" : ""} onClick={() => setPestana("constructor")}>Constructor</button>
              <a className="boton" href={SFIA_URL} target="_blank" rel="noreferrer">Catálogo SFIA ↗</a>
            </nav>
            <span>{me.name ?? me.email} <button onClick={salir}>Salir</button></span>
          </header>
          <main>
            {pestana === "generar" && <GenerateView alCrear={() => setVersion(version + 1)} />}
            {pestana === "constructor" && <ConstructorApp />}
            {pestana === "banco" && (
              <ItemBrowser
                portal="docente"
                modo="docente"
                version={version}
                acciones={(item, recargar, abrir) => (
                  // HU-09 (activar/desactivar), HU-13 (editar), HU-14 (regenerar) y HU-26 (historial).
                  <AccionesItem key={item.id} item={item} recargar={recargar} abrir={abrir} />
                )}
              />
            )}
          </main>
        </>
      )}
    </LoginGate>
  );
}
