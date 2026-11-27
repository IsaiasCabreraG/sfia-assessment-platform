"use client";

// Guardar una evaluación como plantilla, o editar una plantilla (nombre y visibilidad). Una plantilla pública solo puede
// tener ítems públicos: se confirma hacer públicos los ítems propios que hoy son privados; los privados de otros docentes
// y los inactivos lo impiden.
import { useState } from "react";
import { Ventana } from "../shared/Ventana";

export interface ItemDePlantilla { skill_code: string; item_active: boolean; item_public: boolean; is_mine: boolean }

interface Props {
  titulo: string;
  nombreInicial: string;
  visibilidadInicial?: "private" | "public";
  items: ItemDePlantilla[];
  textoGuardar: string;
  alGuardar: (nombre: string, visibilidad: "private" | "public", hacerPublicos: boolean) => Promise<void>;
  alCerrar: () => void;
}

export function DialogoPlantilla({ titulo, nombreInicial, visibilidadInicial = "private", items, textoGuardar, alGuardar, alCerrar }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [visibilidad, setVisibilidad] = useState(visibilidadInicial);
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const codigos = (lista: ItemDePlantilla[]) => [...new Set(lista.map((i) => i.skill_code))].sort().join(", ");
  const inactivos = items.filter((i) => !i.item_active);
  const ajenos = items.filter((i) => i.item_active && !i.item_public && !i.is_mine);
  const propios = items.filter((i) => i.item_active && !i.item_public && i.is_mine);
  const publica = visibilidad === "public";
  const impide = publica && (inactivos.length > 0 || ajenos.length > 0);
  const faltaConfirmar = publica && propios.length > 0 && !confirmado;

  const guardar = async () => {
    setOcupado(true); setError("");
    try { await alGuardar(nombre, visibilidad, publica && propios.length > 0 && confirmado); alCerrar(); }
    catch (e) { setError((e as Error).message); setOcupado(false); }
  };

  return (
    <Ventana titulo={titulo} alCerrar={alCerrar}>
      <div className="formulario ancho-total">
        <label>Nombre
          <input value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <fieldset className="sin-borde">
          <legend>Visibilidad</legend>
          <label className="check"><input type="radio" name="visibilidad" checked={!publica} onChange={() => setVisibilidad("private")} /> Privada (solo yo)</label>
          <label className="check"><input type="radio" name="visibilidad" checked={publica} onChange={() => setVisibilidad("public")} /> Pública (otros docentes la pueden usar)</label>
        </fieldset>
        {publica && inactivos.length > 0 && <p className="error">Hay ítems inactivos ({codigos(inactivos)}): una plantilla pública no puede tenerlos.</p>}
        {publica && ajenos.length > 0 && <p className="error">Hay ítems privados de otros docentes ({codigos(ajenos)}) que no se pueden publicar: la plantilla solo puede ser privada.</p>}
        {publica && !impide && propios.length > 0 && (
          <div className="aviso">
            Se harán públicos <strong>{propios.length} ítem{propios.length === 1 ? "" : "s"} tuyo{propios.length === 1 ? "" : "s"}</strong> que hoy {propios.length === 1 ? "es privado" : "son privados"} ({codigos(propios)}): quedarán visibles para los expertos y en tus otras evaluaciones.
            <label className="check mt-4">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Entiendo y quiero hacerlos públicos
            </label>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="acciones fin">
          <button onClick={alCerrar}>Cancelar</button>
          <button className="primario" disabled={ocupado || !nombre.trim() || impide || faltaConfirmar} onClick={guardar}>{ocupado ? "Guardando…" : textoGuardar}</button>
        </div>
      </div>
    </Ventana>
  );
}
