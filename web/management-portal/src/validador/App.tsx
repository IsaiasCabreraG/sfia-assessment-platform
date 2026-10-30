"use client";

// Portal Validador: filtra los ítems activos por revisar, ve sus atributos y los puntúa.
import { ItemBrowser } from "../shared/ItemBrowser";
import { LoginGate } from "../shared/LoginGate";
import { ScoreForm } from "./ScoreForm";

export function App() {
  return (
    <LoginGate portal="validador" rol="validator" titulo="Portal Validador">
      {(me, salir) => (
        <>
          <header className="barra">
            <strong>Portal Validador</strong>
            <span />
            <span>{me.name ?? me.email} <button onClick={salir}>Salir</button></span>
          </header>
          <main>
            <ItemBrowser
              portal="validador"
              modo="validador"
              acciones={(item, recargar) => <ScoreForm item={item} alPuntuar={recargar} />}
            />
          </main>
        </>
      )}
    </LoginGate>
  );
}
