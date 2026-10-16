import type { Bloque, Catalogo, Formulario, TipoId } from "./tipos";
import { nuevoBloque, resumenBloque, TIPOS } from "./tipos";

type Props = {
  f: Formulario; catalogo: Catalogo; cambiar: (p: Partial<Formulario>) => void;
  onGuardarRol: (nombre: string, bloques: Bloque[]) => Promise<void>;
};

function Recuadro({ b, catalogo, onCambio, onQuitar }: {
  b: Bloque; catalogo: Catalogo; onCambio: (p: Partial<Bloque>) => void; onQuitar: () => void;
}) {
  const nombreDe = (codigo: string) => catalogo.skills.find((s) => s.codigo === codigo)?.nombre ?? codigo;

  function alternarTipo(tipo: TipoId) {
    const ya = b.tipos.some((t) => t.tipo === tipo);
    onCambio({ tipos: ya ? b.tipos.filter((t) => t.tipo !== tipo) : [...b.tipos, { tipo, cantidad: 2 }] });
  }
  const cantidadDe = (tipo: TipoId, cantidad: number) =>
    onCambio({ tipos: b.tipos.map((t) => (t.tipo === tipo ? { ...t, cantidad } : t)) });

  return (
    <div className={`recuadro ${b.abierto ? "abierto" : ""}`}>
      <div className="recuadro-cab">
        <button type="button" className="toggle" aria-expanded={b.abierto} aria-label={`${b.abierto ? "Minimizar" : "Expandir"} ${b.codigo}`}
          onClick={() => onCambio({ abierto: !b.abierto })}>
          <span className="flecha">▸</span>
          <span className="titulo"><b>{b.codigo}</b> · nivel {b.nivel}<small>{nombreDe(b.codigo)}</small></span>
        </button>
        {!b.abierto && <span className="resumen-linea">{resumenBloque(b)}</span>}
        <button type="button" className="quitar" aria-label={`Quitar ${b.codigo}`} onClick={onQuitar}>×</button>
      </div>

      {b.abierto && (
        <div className="recuadro-cuerpo">
          <div className="dos">
            <label>Skill
              <select value={b.codigo} onChange={(e) => onCambio({ codigo: e.target.value, nombre: nombreDe(e.target.value) })}>
                {catalogo.skills.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
              </select>
            </label>
            <label>Nivel de responsabilidad
              <select value={b.nivel} onChange={(e) => onCambio({ nivel: Number(e.target.value) })}>
                {Object.entries(catalogo.niveles).map(([n, nombre]) => <option key={n} value={n}>Nivel {n} · {nombre}</option>)}
              </select>
            </label>
          </div>

          <p className="etiqueta">Tipos de ejercicio y cantidad</p>
          <div className="lista">
            {(Object.keys(TIPOS) as TipoId[]).map((tipo) => {
              const el = b.tipos.find((t) => t.tipo === tipo);
              return (
                <div key={tipo} className={`item ${el ? "sel" : ""}`}>
                  <label className="fila">
                    <input type="checkbox" checked={!!el} onChange={() => alternarTipo(tipo)} />
                    {TIPOS[tipo]}
                  </label>
                  {el && (
                    <input type="number" min={1} max={10} aria-label={`Cantidad de ${TIPOS[tipo]} en ${b.codigo}`} value={el.cantidad}
                      onChange={(e) => cantidadDe(tipo, Number(e.target.value))} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="dos">
            <label>Dificultad
              <select value={b.dificultad} onChange={(e) => onCambio({ dificultad: e.target.value as Bloque["dificultad"] })}>
                <option value="basica">Básica</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label>Tiempo estimado por ítem (min)
              <input type="number" min={1} value={b.tiempo_min} onChange={(e) => onCambio({ tiempo_min: Number(e.target.value) })} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PasoQueEvaluar({ f, catalogo, cambiar, onGuardarRol }: Props) {
  const nombreDe = (codigo: string) => catalogo.skills.find((s) => s.codigo === codigo)?.nombre ?? codigo;

  function elegirRol(id: string) {
    if (id === "") return cambiar({ rol: "" }); // rol personalizado: se conservan los recuadros
    const rol = catalogo.roles.find((r) => r.id === id);
    if (!rol) return;
    if (f.bloques.length > 0 && !window.confirm("Esto reemplazará los recuadros actuales por los del rol. ¿Continuar?")) return;
    cambiar({
      rol: id,
      bloques: rol.skills.map((s) => ({
        ...nuevoBloque(s.codigo, nombreDe(s.codigo), s.nivel, false),
        ...(s.tipos && { tipos: s.tipos }),
        ...(s.dificultad && { dificultad: s.dificultad }),
        ...(s.tiempo_min && { tiempo_min: s.tiempo_min }),
      })),
    });
  }

  const cambiarBloque = (uid: string, p: Partial<Bloque>) =>
    cambiar({ bloques: f.bloques.map((b) => (b.uid === uid ? { ...b, ...p } : b)) });
  const quitar = (uid: string) => cambiar({ bloques: f.bloques.filter((b) => b.uid !== uid) });
  const todos = (abierto: boolean) => cambiar({ bloques: f.bloques.map((b) => ({ ...b, abierto })) });

  function guardar() {
    const nombre = window.prompt("Nombre del rol a guardar:");
    if (nombre?.trim()) void onGuardarRol(nombre.trim(), f.bloques);
  }

  function anadir(codigo: string) {
    const s = catalogo.skills.find((x) => x.codigo === codigo);
    if (s) cambiar({ bloques: [...f.bloques, nuevoBloque(s.codigo, s.nombre, 3, true)] });
  }

  return (
    <>
      <div className="rol-fila">
        <label>Rol SFIA
          <select value={f.rol} onChange={(e) => elegirRol(e.target.value)}>
            <option value="">Rol personalizado</option>
            {catalogo.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.propio ? " (guardado)" : ""}</option>)}
          </select>
        </label>
        <button type="button" className="guardar-rol" disabled={f.bloques.length === 0} onClick={guardar}>Guardar rol</button>
      </div>

      <div className="barra">
        <p className="etiqueta">Skills a evaluar ({f.bloques.length})</p>
        {f.bloques.length > 1 && (
          <span className="barra-acc">
            <button type="button" className="enlace" onClick={() => todos(true)}>Expandir todo</button>
            <button type="button" className="enlace" onClick={() => todos(false)}>Minimizar todo</button>
          </span>
        )}
      </div>

      {f.bloques.length === 0 && <p className="ayuda">Aún no hay skills. Elige un rol o añade una.</p>}
      {f.bloques.map((b) => (
        <Recuadro key={b.uid} b={b} catalogo={catalogo} onCambio={(p) => cambiarBloque(b.uid, p)} onQuitar={() => quitar(b.uid)} />
      ))}

      <select className="anadir" aria-label="Añadir skill" value="" onChange={(e) => anadir(e.target.value)}>
        <option value="">+ Añadir skill…</option>
        {catalogo.skills.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
      </select>
    </>
  );
}
