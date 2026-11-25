"use client";

// Ficha de un ítem del banco (la misma vista que el banco): de la versión vigente o de una versión concreta, que es la
// que una evaluación tiene fijada. Avisa si el ítem tiene una versión más nueva.
import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { ItemDetail } from "../shared/ItemDetail";
import type { ItemDetailData } from "../shared/types";
import { Ventana } from "./Ventana";

export function FichaItem({ itemId, version, alCerrar }: { itemId: string; version?: number; alCerrar: () => void }) {
  const [estado, setEstado] = useState<{ cargando: boolean; item?: ItemDetailData; error?: string }>({ cargando: true });

  useEffect(() => {
    api<ItemDetailData>("docente", `${CONTENT_URL}/items/${itemId}${version ? `?version=${version}` : ""}`)
      .then((item) => setEstado({ cargando: false, item }))
      .catch((e) => setEstado({ cargando: false, error: e.message }));
  }, [itemId, version]);

  const { cargando, item, error } = estado;
  return (
    <Ventana titulo="Ficha del ítem" alCerrar={alCerrar}>
      {cargando && <p className="suave">Cargando…</p>}
      {error && <p className="error">No se puede mostrar este ítem: {error}</p>}
      {item && (
        <>
          {version !== undefined && item.latest_version !== undefined && item.latest_version > version && (
            <p className="aviso">Esta evaluación usa la versión {version} de este ítem; hay una versión más nueva ({item.latest_version}). La evaluación conserva la que tiene fijada.</p>
          )}
          <ItemDetail item={item} />
        </>
      )}
    </Ventana>
  );
}
