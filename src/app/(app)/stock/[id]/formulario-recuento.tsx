"use client";

import { useActionState, useState } from "react";
import { cantidadConCeroABase, diferenciaDeRecuento, MOTIVOS_AJUSTE } from "@/lib/stock";
import type { TipoVenta } from "@/lib/precios";
import { registrarRecuentoAccion, type EstadoRecuento } from "./actions";

const campo = "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-miel";
const borde = (e: boolean) => (e ? "border-red-400/70" : "border-crema/20");

/** "use client" para mostrar la diferencia en vivo mientras se escribe lo contado. El cálculo que vale lo hace la base al guardar. */
export function FormularioRecuento({ productoId, tipoVenta, stockActual, claveInicial }: { productoId: number; tipoVenta: TipoVenta; stockActual: number; claveInicial: string }) {
  const [estado, accion, enviando] = useActionState<EstadoRecuento, FormData>(registrarRecuentoAccion, {
    intento: 0,
    errores: {},
    mensaje: null,
    valores: { productoId: String(productoId), contado: "", motivo: "Recuento físico", detalle: "", clave: claveInicial },
  });
  const [contadoTexto, setContadoTexto] = useState(estado.valores.contado);
  const { errores, valores } = estado;

  let diferencia: ReturnType<typeof diferenciaDeRecuento> | null = null;
  if (contadoTexto.trim() !== "") {
    try {
      diferencia = diferenciaDeRecuento(stockActual, cantidadConCeroABase(contadoTexto, tipoVenta), tipoVenta);
    } catch {
      /* todavía incompleto o inválido: el error se muestra al guardar */
    }
  }

  return (
    <form action={accion} noValidate className="space-y-4">
      <input type="hidden" name="productoId" value={productoId} />
      <input type="hidden" name="clave" value={claveInicial} />
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}
      {errores.clave && <p role="alert" data-error="clave" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{errores.clave}</p>}

      <div key={estado.intento} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contado" className="text-sm">Cuánto hay realmente {tipoVenta === "peso" ? "(kg)" : "(unidades)"}</label>
          <input
            id="contado"
            name="contado"
            defaultValue={valores.contado}
            onChange={(e) => setContadoTexto(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={tipoVenta === "peso" ? "Ej.: 2,5  (si no queda nada: 0)" : "Ej.: 12  (si no queda nada: 0)"}
            aria-invalid={!!errores.contado}
            className={`${campo} ${borde(!!errores.contado)}`}
          />
          {diferencia && (
            <p data-diferencia={diferencia.tipo} className={`text-sm ${diferencia.tipo === "coincide" ? "text-emerald-300" : diferencia.tipo === "faltan" ? "text-amber-300" : "text-miel"}`}>
              {diferencia.texto}
            </p>
          )}
          {errores.contado && <p data-error="contado" className="text-sm text-red-300">{errores.contado}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo" className="text-sm">Motivo</label>
            <select id="motivo" name="motivo" defaultValue={valores.motivo} aria-invalid={!!errores.motivo} className={`${campo} ${borde(!!errores.motivo)}`}>
              {MOTIVOS_AJUSTE.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {errores.motivo && <p data-error="motivo" className="text-sm text-red-300">{errores.motivo}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="detalle" className="text-sm">Detalle <span className="text-crema/50">(opcional)</span></label>
            <input id="detalle" name="detalle" defaultValue={valores.detalle} maxLength={120} autoComplete="off" aria-invalid={!!errores.detalle} className={`${campo} ${borde(!!errores.detalle)}`} />
            {errores.detalle && <p data-error="detalle" className="text-sm text-red-300">{errores.detalle}</p>}
          </div>
        </div>
      </div>

      <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60">
        {enviando ? "Guardando…" : "Guardar recuento"}
      </button>
      <p className="text-xs text-crema/50">El stock queda exactamente en lo que contaste. Si mientras tanto se vendió algo, el sistema lo tiene en cuenta al guardar.</p>
    </form>
  );
}
