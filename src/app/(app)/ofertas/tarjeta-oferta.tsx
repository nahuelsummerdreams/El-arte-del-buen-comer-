"use client";

import { useState } from "react";
import { formatearPesos, formatearStock } from "@/lib/precios";
import { DESCUENTOS, margenDeOferta, precioConOferta, textoCartel, type Descuento, type FilaOferta } from "@/lib/ofertas";
import { enlaceWhatsApp } from "@/lib/ticket";
import { textoVencimiento } from "@/lib/costos";
import { aplicarOfertaAccion, quitarOfertaAccion } from "./actions";

/**
 * Una oferta sugerida. "use client" para elegir el descuento y ver al instante el precio, el margen y el
 * cartel. Al aplicar, el servidor recalcula todo con el precio real de la base.
 */
export function TarjetaOferta({ f, precioAntesDeOferta }: { f: FilaOferta; precioAntesDeOferta: number | null }) {
  const [descuento, setDescuento] = useState<Descuento>(f.sugerido ?? 20);
  const vencido = f.diasRestantes < 0;
  const precioOferta = f.precio !== null ? precioConOferta(f.precio, descuento) : null;
  const margen = precioOferta !== null ? margenDeOferta(precioOferta, f.costo) : null;
  const unidad = f.tipoVenta === "peso" ? "el kilo" : "cada una";
  const cartel = f.precio !== null && precioOferta !== null ? textoCartel({ nombre: f.nombre, tipoVenta: f.tipoVenta, precioAnterior: f.precio, precioOferta, descuento, quedan: f.quedan }) : null;
  const urgente = f.diasRestantes <= 1;

  return (
    <li data-oferta={f.productoId} className="fx-entra rounded-2xl border border-crema/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{f.nombre}</p>
          <p className="text-xs text-crema/60">Quedan unos {formatearStock(f.quedan, f.tipoVenta)} · vence el {f.venceEl.split("-").reverse().join("/")}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${vencido || urgente ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>{textoVencimiento(f.diasRestantes)}</span>
      </div>

      {vencido ? (
        <p className="mt-3 text-sm text-crema/75">
          Ya venció: no se ofrece, se retira del mostrador. <a href="/inventario/merma" className="underline underline-offset-4">Registrar la pérdida</a>
        </p>
      ) : f.precio === null || precioOferta === null ? (
        <p className="mt-3 text-sm text-crema/65">Este producto no tiene precio cargado.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Descuento">
            {DESCUENTOS.map((d) => (
              <button key={d} type="button" onClick={() => setDescuento(d)} aria-pressed={descuento === d} data-descuento={d}
                className={`rounded-full border px-3 py-1 text-sm transition ${descuento === d ? "border-crema bg-crema text-tinta" : "border-crema/25 text-crema/80 hover:bg-white/5"}`}>
                {d} %{d === f.sugerido ? " · sugerido" : ""}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p data-precio-oferta className="text-2xl font-semibold tabular-nums">{formatearPesos(precioOferta)} <span className="text-sm font-normal text-crema/60">{unidad}</span></p>
            <p className="text-sm text-crema/55 line-through">{formatearPesos(f.precio)}</p>
            {margen && (
              <p data-margen={margen.pierde ? "pierde" : "ok"} className={`text-sm ${margen.pierde ? "text-red-300" : "text-crema/70"}`}>
                {margen.margenPct === null ? "Sin costo cargado: no se sabe el margen" : margen.pierde ? `Por debajo del costo (${formatearPesos(f.costo!)}): vendés con pérdida, pero evitás tirarlo` : `Margen ${margen.margenPct} % sobre el costo ${formatearPesos(f.costo!)}`}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {precioAntesDeOferta !== null ? (
              <form action={quitarOfertaAccion}>
                <input type="hidden" name="productoId" value={f.productoId} />
                <button type="submit" data-quitar className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5">Volver a {formatearPesos(precioAntesDeOferta)}</button>
              </form>
            ) : (
              <form action={aplicarOfertaAccion}>
                <input type="hidden" name="productoId" value={f.productoId} />
                <input type="hidden" name="descuento" value={descuento} />
                <button type="submit" data-aplicar className="rounded-lg bg-crema px-4 py-2 text-sm font-medium text-tinta transition hover:bg-crema/90">Poner este precio</button>
              </form>
            )}
            {cartel && <a href={enlaceWhatsApp(cartel)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5">Mandar por WhatsApp</a>}
          </div>
          {cartel && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-crema/65">Texto para el cartel</summary>
              <pre data-cartel className="mt-2 whitespace-pre-wrap rounded-lg bg-white/5 p-3 font-sans text-crema/85">{cartel}</pre>
            </details>
          )}
        </>
      )}
    </li>
  );
}
