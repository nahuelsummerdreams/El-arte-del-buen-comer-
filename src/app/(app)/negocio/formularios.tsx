"use client";

import { useActionState } from "react";
import { agregarGastoAccion, guardarMetaAccion, type EstadoSimple } from "./actions";

const campo = "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (e: boolean) => (e ? "border-red-400/70" : "border-crema/20");
const inicial = (valores: Record<string, string>): EstadoSimple => ({ intento: 0, errores: {}, mensaje: null, valores });

export function FormularioMeta({ actual }: { actual: string }) {
  const [estado, accion, enviando] = useActionState(guardarMetaAccion, inicial({ meta: "" }));
  return (
    <form action={accion} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}
      <div key={estado.intento} className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="meta" className="text-sm">Meta de ventas de este mes <span className="text-crema/50">($)</span></label>
        <input id="meta" name="meta" defaultValue={estado.valores.meta} inputMode="decimal" autoComplete="off" placeholder={actual || "Ej.: 5.000.000"} aria-invalid={!!estado.errores.meta} className={`${campo} ${borde(!!estado.errores.meta)}`} />
        {estado.errores.meta && <p data-error="meta" className="text-sm text-red-300">{estado.errores.meta}</p>}
      </div>
      <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60 sm:mt-[1.65rem]">
        {enviando ? "Guardando…" : actual ? "Cambiar meta" : "Guardar meta"}
      </button>
    </form>
  );
}

export function FormularioGasto() {
  const [estado, accion, enviando] = useActionState(agregarGastoAccion, inicial({ nombre: "", monto: "" }));
  return (
    <form action={accion} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}
      <div key={estado.intento} className="contents">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm">Gasto</label>
          <input id="nombre" name="nombre" defaultValue={estado.valores.nombre} maxLength={60} autoComplete="off" placeholder="Ej.: Alquiler" aria-invalid={!!estado.errores.nombre} className={`${campo} ${borde(!!estado.errores.nombre)}`} />
          {estado.errores.nombre && <p data-error="nombre" className="text-sm text-red-300">{estado.errores.nombre}</p>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="monto" className="text-sm">Por mes <span className="text-crema/50">($)</span></label>
          <input id="monto" name="monto" defaultValue={estado.valores.monto} inputMode="decimal" autoComplete="off" placeholder="Ej.: 450.000" aria-invalid={!!estado.errores.monto} className={`${campo} ${borde(!!estado.errores.monto)}`} />
          {estado.errores.monto && <p data-error="monto" className="text-sm text-red-300">{estado.errores.monto}</p>}
        </div>
      </div>
      <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60 sm:mt-[1.65rem]">
        {enviando ? "Guardando…" : "Agregar"}
      </button>
    </form>
  );
}
