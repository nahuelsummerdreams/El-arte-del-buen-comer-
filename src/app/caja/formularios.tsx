"use client";

import { useActionState } from "react";
import { TIPOS_MOVIMIENTO_CAJA } from "@/lib/caja";
import { abrirCajaAccion, cerrarCajaAccion, registrarMovimientoAccion, type EstadoCaja } from "./actions";

const campo = "w-full rounded-lg border bg-white/5 px-3.5 py-3 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");
const boton =
  "rounded-lg bg-crema px-5 py-3 font-medium text-tinta shadow-lg shadow-black/30 transition hover:bg-crema/90 active:scale-[0.99] disabled:opacity-60";

const estado = (valores: Record<string, string>): EstadoCaja => ({ intento: 0, errores: {}, mensaje: null, valores });

function Alerta({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
      {mensaje}
    </p>
  );
}

function Error({ campo, texto }: { campo: string; texto?: string }) {
  return texto ? <p data-error={campo} className="text-sm text-red-300">{texto}</p> : null;
}

// Cada formulario es "use client" para mostrar errores sin recargar y deshabilitar el botón mientras envía.
// El trabajo real (validar y guardar) corre en el servidor, en actions.ts.
// key={estado.intento}: React 19 reinicia el formulario al terminar la acción; con una key nueva los
// campos se vuelven a crear con lo que la persona había escrito.

export function FormularioAbrirCaja() {
  const [e, accion, enviando] = useActionState(abrirCajaAccion, estado({ efectivoInicial: "" }));
  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <Alerta mensaje={e.mensaje} />
      <div key={e.intento} className="flex flex-col gap-1.5">
        <label htmlFor="efectivoInicial" className="text-sm">Efectivo con el que abrís la caja ($)</label>
        <input
          id="efectivoInicial" name="efectivoInicial" defaultValue={e.valores.efectivoInicial}
          inputMode="decimal" autoComplete="off" placeholder="Ej.: 5.000 (o 0 si no hay)"
          aria-invalid={!!e.errores.efectivoInicial} className={`${campo} ${borde(!!e.errores.efectivoInicial)}`}
        />
        <Error campo="efectivoInicial" texto={e.errores.efectivoInicial} />
      </div>
      <button type="submit" disabled={enviando} className={boton}>{enviando ? "Abriendo…" : "Abrir caja"}</button>
    </form>
  );
}

const ETIQUETA_TIPO: Record<string, string> = { retiro: "Retiro de efectivo", gasto: "Gasto", ingreso: "Ingreso de efectivo" };

export function FormularioMovimiento() {
  const [e, accion, enviando] = useActionState(registrarMovimientoAccion, estado({ tipo: "", monto: "", motivo: "" }));
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <Alerta mensaje={e.mensaje} />
      <div key={e.intento} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={e.valores.tipo} aria-invalid={!!e.errores.tipo} className={`${campo} ${borde(!!e.errores.tipo)}`}>
            <option value="">Elegí…</option>
            {TIPOS_MOVIMIENTO_CAJA.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
          <Error campo="tipo" texto={e.errores.tipo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monto" className="text-sm">Monto ($)</label>
          <input id="monto" name="monto" defaultValue={e.valores.monto} inputMode="decimal" autoComplete="off" placeholder="Ej.: 1.000"
            aria-invalid={!!e.errores.monto} className={`${campo} ${borde(!!e.errores.monto)}`} />
          <Error campo="monto" texto={e.errores.monto} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="motivo" className="text-sm">Motivo</label>
          <input id="motivo" name="motivo" defaultValue={e.valores.motivo} maxLength={120} autoComplete="off" placeholder="Ej.: Pago a proveedor"
            aria-invalid={!!e.errores.motivo} className={`${campo} ${borde(!!e.errores.motivo)}`} />
          <Error campo="motivo" texto={e.errores.motivo} />
        </div>
      </div>
      <button type="submit" disabled={enviando} className={`${boton} self-start`}>{enviando ? "Registrando…" : "Registrar movimiento"}</button>
    </form>
  );
}

export function FormularioCerrarCaja() {
  const [e, accion, enviando] = useActionState(cerrarCajaAccion, estado({ efectivoContado: "", nota: "" }));
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <Alerta mensaje={e.mensaje} />
      <div key={e.intento} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="efectivoContado" className="text-sm">Efectivo que contaste en el cajón ($)</label>
          <input id="efectivoContado" name="efectivoContado" defaultValue={e.valores.efectivoContado} inputMode="decimal" autoComplete="off"
            placeholder="Ej.: 19.500 (o 0 si no hay)" aria-invalid={!!e.errores.efectivoContado} className={`${campo} ${borde(!!e.errores.efectivoContado)}`} />
          <Error campo="efectivoContado" texto={e.errores.efectivoContado} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota" className="text-sm">Nota <span className="text-crema/50">(opcional)</span></label>
          <input id="nota" name="nota" defaultValue={e.valores.nota} maxLength={200} autoComplete="off"
            aria-invalid={!!e.errores.nota} className={`${campo} ${borde(!!e.errores.nota)}`} />
          <Error campo="nota" texto={e.errores.nota} />
        </div>
      </div>
      <button type="submit" disabled={enviando} className={`${boton} self-start`}>{enviando ? "Cerrando…" : "Cerrar caja"}</button>
    </form>
  );
}
