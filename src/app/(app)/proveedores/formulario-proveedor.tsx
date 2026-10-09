"use client";

import { useActionState } from "react";
import { crearProveedorAccion, type EstadoProveedor } from "./actions";

const campo = "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (e: boolean) => (e ? "border-red-400/70" : "border-crema/20");

export function FormularioProveedor() {
  const [estado, accion, enviando] = useActionState<EstadoProveedor, FormData>(crearProveedorAccion, {
    intento: 0, errores: {}, mensaje: null, valores: { nombre: "", telefono: "" },
  });
  const { errores, valores } = estado;
  return (
    <form action={accion} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200 sm:order-last">{estado.mensaje}</p>}
      <div key={estado.intento} className="contents">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={valores.nombre} maxLength={60} autoComplete="off" aria-invalid={!!errores.nombre} className={`${campo} ${borde(!!errores.nombre)}`} />
          {errores.nombre && <p data-error="nombre" className="text-sm text-red-300">{errores.nombre}</p>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="telefono" className="text-sm">Teléfono <span className="text-crema/50">(opcional)</span></label>
          <input id="telefono" name="telefono" defaultValue={valores.telefono} inputMode="tel" autoComplete="off" aria-invalid={!!errores.telefono} className={`${campo} ${borde(!!errores.telefono)}`} />
          {errores.telefono && <p data-error="telefono" className="text-sm text-red-300">{errores.telefono}</p>}
        </div>
      </div>
      <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60 sm:mt-[1.65rem]">
        {enviando ? "Guardando…" : "Agregar"}
      </button>
    </form>
  );
}
