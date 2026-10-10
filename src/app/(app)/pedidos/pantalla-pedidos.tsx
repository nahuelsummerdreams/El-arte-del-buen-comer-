"use client";

import { useState } from "react";
import { cantidadATextoEditable, costoDelPedido, textoPedido } from "@/lib/pedidos";
import { formatearCantidad, formatearPesos, formatearStock, type TipoVenta } from "@/lib/precios";
import { cantidadConCeroABase } from "@/lib/stock";
import { enlaceWhatsApp } from "@/lib/ticket";

export type ItemPedido = {
  id: number; nombre: string; tipoVenta: TipoVenta; stock: number; proveedorId: number | null; costo: number | null;
  sugerida: number; motivo: "ritmo" | "minimo" | "sin_datos"; vendido: number;
};
export type ProveedorPedido = { id: number; nombre: string; telefono: string | null };

const SIN_PROVEEDOR = 0;

/** Lee lo escrito; null si no es una cantidad válida (vacío cuenta como cero). */
function leer(texto: string, tipo: TipoVenta): number | null {
  if (texto.trim() === "") return 0;
  try { return cantidadConCeroABase(texto, tipo); } catch { return null; }
}

function motivoTexto(i: ItemPedido): string {
  if (i.motivo === "ritmo") return `Vendiste ${formatearCantidad(i.vendido, i.tipoVenta)} en los últimos 30 días: se pide para cubrir una semana.`;
  if (i.motivo === "minimo") return "Se calculó con el doble de tu stock mínimo.";
  return "Sin ventas ni mínimo cargado: decidí vos cuánto pedir.";
}

export function PantallaPedidos({ items, proveedores }: { items: ItemPedido[]; proveedores: ProveedorPedido[] }) {
  const [textos, setTextos] = useState<Record<number, string>>(() => Object.fromEntries(items.map((i) => [i.id, cantidadATextoEditable(i.sugerida, i.tipoVenta)])));
  const [asignado, setAsignado] = useState<Record<number, number>>({});
  const [copiado, setCopiado] = useState<number | null>(null);

  if (items.length === 0) {
    return <p data-sin-pedidos className="rounded-2xl border border-dashed border-crema/20 px-6 py-12 text-center text-emerald-300">✓ No hay nada para reponer. Todo está por encima del mínimo.</p>;
  }

  const proveedorDe = (i: ItemPedido) => asignado[i.id] ?? i.proveedorId ?? SIN_PROVEEDOR;
  const grupos = new Map<number, ItemPedido[]>();
  for (const i of items) grupos.set(proveedorDe(i), [...(grupos.get(proveedorDe(i)) ?? []), i]);
  const orden = [...grupos.keys()].sort((a, b) => (a === SIN_PROVEEDOR ? 1 : b === SIN_PROVEEDOR ? -1 : (proveedores.find((p) => p.id === a)?.nombre ?? "").localeCompare(proveedores.find((p) => p.id === b)?.nombre ?? "", "es")));

  return (
    <div className="space-y-5">
      {orden.map((pid) => {
        const prov = proveedores.find((p) => p.id === pid) ?? null;
        const filas = grupos.get(pid) ?? [];
        const lineas = filas.map((i) => ({ i, cantidad: leer(textos[i.id] ?? "", i.tipoVenta) }));
        const hayInvalidas = lineas.some((l) => l.cantidad === null);
        const validas = lineas.flatMap((l) => (l.cantidad !== null && l.cantidad > 0 ? [{ i: l.i, cantidad: l.cantidad }] : []));
        const costos = validas.map((l) => costoDelPedido(l.cantidad, l.i.costo, l.i.tipoVenta));
        const total = costos.reduce<number>((s, c) => s + (c ?? 0), 0);
        const sinCosto = costos.filter((c) => c === null).length;
        const texto = textoPedido(prov?.nombre ?? null, validas.map((l) => ({ nombre: l.i.nombre, tipoVenta: l.i.tipoVenta, cantidad: l.cantidad })));
        const puede = validas.length > 0 && !hayInvalidas;

        return (
          <section key={pid} data-grupo-proveedor={prov?.nombre ?? "sin"} className="fx-entra rounded-2xl border border-crema/10 bg-white/[0.04] p-4 sm:p-5">
            <h2 className="text-lg font-medium">{prov?.nombre ?? "Sin proveedor asignado"}</h2>
            {!prov && <p className="text-xs text-crema/60">Todavía no sabemos a quién se lo comprás. Elegí un proveedor en cada producto para armar el pedido.</p>}
            <ul className="mt-3 divide-y divide-crema/10">
              {lineas.map(({ i, cantidad }) => (
                <li key={i.id} data-pedido-item={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium">{i.nombre}</p>
                    <p className="text-xs text-crema/60">Hay {formatearStock(i.stock, i.tipoVenta)} · {motivoTexto(i)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-crema/70">
                    <span className="sr-only">Cantidad a pedir de {i.nombre}</span>
                    <input
                      inputMode="decimal"
                      value={textos[i.id] ?? ""}
                      onChange={(e) => setTextos((t) => ({ ...t, [i.id]: e.target.value }))}
                      aria-invalid={cantidad === null}
                      className={`w-24 rounded-lg border bg-white/5 px-3 py-2 text-right text-sm tabular-nums ${cantidad === null ? "border-red-400/60" : "border-crema/20"}`}
                    />
                    {i.tipoVenta === "peso" ? "kg" : "u."}
                  </label>
                  <select
                    aria-label={`Proveedor de ${i.nombre}`}
                    value={proveedorDe(i)}
                    onChange={(e) => setAsignado((a) => ({ ...a, [i.id]: Number(e.target.value) }))}
                    className="rounded-lg border border-crema/20 bg-tinta px-2 py-2 text-xs"
                  >
                    <option value={SIN_PROVEEDOR}>Sin proveedor</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {cantidad === null && <p role="alert" className="w-full text-xs text-red-300">{i.tipoVenta === "peso" ? "Escribila en kilos, con coma. Ejemplo: 2,5" : "Escribí un número entero."}</p>}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p data-costo-pedido className="text-sm text-crema/70">
                {validas.length === 0 ? "Sin cantidades para pedir." : <>Costo estimado: <strong className="tabular-nums text-crema">{sinCosto === validas.length ? "sin costos cargados" : formatearPesos(total)}</strong>{sinCosto > 0 && sinCosto < validas.length && <span className="text-crema/60"> (sin contar {sinCosto} sin costo)</span>}</>}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!puede}
                  onClick={() => { void navigator.clipboard?.writeText(texto).then(() => setCopiado(pid)).catch(() => undefined); }}
                  className="rounded-lg border border-crema/25 px-4 py-2 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copiado === pid ? "✓ Copiado" : "Copiar pedido"}
                </button>
                {puede ? (
                  <a data-whatsapp-pedido href={enlaceWhatsApp(texto, prov?.telefono ?? undefined)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-miel px-4 py-2 text-sm font-medium text-tinta hover:brightness-110">
                    Mandar por WhatsApp
                  </a>
                ) : (
                  <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-miel/40 px-4 py-2 text-sm font-medium text-tinta/70">Mandar por WhatsApp</span>
                )}
              </div>
            </div>
            {puede && prov && !prov.telefono && <p className="mt-2 text-xs text-crema/55">{prov.nombre} no tiene teléfono cargado: WhatsApp te deja elegir a quién mandarlo.</p>}
          </section>
        );
      })}
      <p className="text-xs text-crema/50">Las cantidades salen de lo que vendiste en los últimos 30 días (para cubrir una semana) o, si no hay ventas, del doble del stock mínimo. Son una sugerencia: podés cambiarlas. El proveedor propuesto es el de la última mercadería que ingresaste.</p>
    </div>
  );
}
