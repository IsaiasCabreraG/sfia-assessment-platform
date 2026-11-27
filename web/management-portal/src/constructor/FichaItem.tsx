"use client";

// Ficha de un ítem del banco, con las mismas acciones que en el banco (editar, regenerar, historial y activar o
// desactivar): de la versión vigente o de una versión concreta, que es la que una evaluación tiene fijada. Avisa si el
// ítem tiene una versión más nueva; editarlo no cambia la versión que la evaluación ya tiene fijada.
import { useEffect, useState } from "react";
import { AccionesItem } from "../docente/AccionesItem";
import { api } from "../shared/api";
import { CONTENT_URL } from "../shared/config";
import { useDatosSkill } from "../shared/DescripcionSkill";
import { ItemDetail } from "../shared/ItemDetail";
import type { ItemDetailData } from "../shared/types";
import { Ventana } from "../shared/Ventana";

export function FichaItem({ itemId: itemInicial, version, alCerrar }: { itemId: string; version?: number; alCerrar: () => void }) {
  const [itemId, setItemId] = useState(itemInicial);   // cambia si editar un ítem ajeno crea una copia propia
  const [recarga, setRecarga] = useState(0);
  const [barra, setBarra] = useState<HTMLElement | null>(null);
  const [estado, setEstado] = useState<{ cargando: boolean; item?: ItemDetailData; error?: string }>({ cargando: true });
  const versionPedida = itemId === itemInicial ? version : undefined;

  useEffect(() => {
    let vigente = true;
    api<ItemDetailData>("docente", `${CONTENT_URL}/items/${itemId}${versionPedida ? `?version=${versionPedida}` : ""}`)
      .then((item) => { if (vigente) setEstado({ cargando: false, item }); })
      .catch((e) => { if (vigente) setEstado({ cargando: false, error: e.message }); });
    return () => { vigente = false; };
  }, [itemId, versionPedida, recarga]);

  const { cargando, item, error } = estado;
  const categoria = useDatosSkill(item?.skill.id ?? null)?.category ?? null;
  return (
    <Ventana titulo="Ficha del ítem" alCerrar={alCerrar}>
      {cargando && <p className="suave">Cargando…</p>}
      {error && <p className="error">No se puede mostrar este ítem: {error}</p>}
      {item && (
        <>
          <div className="panel-cabecera"><span className="barra-iconos" ref={setBarra} /></div>
          {versionPedida !== undefined && item.latest_version !== undefined && item.latest_version > versionPedida && (
            <p className="aviso">Esta evaluación usa la versión {versionPedida} de este ítem; hay una versión más nueva ({item.latest_version}). La evaluación conserva la que tiene fijada.</p>
          )}
          <ItemDetail item={item} categoria={categoria} />
          <AccionesItem key={item.id} item={item} recargar={() => setRecarga((n) => n + 1)} abrir={setItemId} barra={barra} />
        </>
      )}
    </Ventana>
  );
}
