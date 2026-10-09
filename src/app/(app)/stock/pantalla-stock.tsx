"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/icono";
import { formatearStock } from "@/lib/precios";
import { contarPorEstado, estadoDeStock, ETIQUETA_ESTADO, filtrarStock, ordenarPorUrgencia, type EstadoStock, type ItemStock } from "@/lib/stock";

type Categoria = { id: number; nombre: string };
type Filtro = EstadoStock | "atencion" | null;

const ESTILO: Record<EstadoStock, string> = {
  negativo: "bg-red-400/10 text-red-300",
  sin_stock: "bg-red-400/10 text-red-300",
  bajo: "bg-amber-400/10 text-amber-300",
  ok: "bg-emerald-400/10 text-emerald-300",
};

/**
 * La pantalla de stock. "use client" porque filtra y busca mientras escribís (sin recargar).
 * Todos los datos ya vienen del servidor; acá solo se ordenan y se muestran.
 */
export function PantallaStock({ items, categorias, puedeEditar }: { items: ItemStock[]; categorias: Categoria[]; puedeEditar: boolean }) {
  const [texto, setTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [estado, setEstado] = useState<Filtro>(null);

  const conteo = contarPorEstado(items);
  const atencion = conteo.negativo + conteo.sin_stock + conteo.bajo;
  const visibles = ordenarPorUrgencia(filtrarStock(items, { texto, categoriaId, estado }));
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${activo ? "border-crema bg-crema text-tinta" : "border-crema/25 text-crema/80 hover:bg-white/5"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="buscar-stock" className="sr-only">Buscar producto</label>
        <input
          id="buscar-stock"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar producto…"
          autoComplete="off"
          className="w-full rounded-xl border border-crema/20 bg-white/5 px-4 py-2.5 outline-none transition focus:border-miel sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <button type="button" onClick={() => setEstado(null)} aria-pressed={estado === null} className={chip(estado === null)}>Todos ({items.length})</button>
          <button type="button" onClick={() => setEstado(estado === "atencion" ? null : "atencion")} aria-pressed={estado === "atencion"} className={chip(estado === "atencion")} data-filtro="atencion">
            Para revisar ({atencion})
          </button>
        </div>
      </div>

      {categorias.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          <button type="button" onClick={() => setCategoriaId(null)} aria-pressed={categoriaId === null} className={chip(categoriaId === null)}>Todas las categorías</button>
          {categorias.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)} aria-pressed={categoriaId === c.id} className={chip(categoriaId === c.id)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <p data-stock-vacio className="rounded-2xl border border-dashed border-crema/20 px-6 py-12 text-center text-crema/70">
          {items.length === 0 ? "Todavía no hay productos cargados." : "Ningún producto coincide con lo que buscás."}
        </p>
      ) : (
        <ul className="divide-y divide-crema/10 overflow-hidden rounded-2xl border border-crema/10 bg-white/[0.04]" data-lista-stock>
          {visibles.map((i, n) => {
            const e = estadoDeStock(i.stock, i.stockMinimo);
            const contenido = (
              <>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.nombre}</span>
                  <span className="text-xs text-crema/55">
                    {nombreCategoria.get(i.categoriaId) ?? "Sin categoría"}
                    {i.stockMinimo > 0 ? ` · mínimo ${formatearStock(i.stockMinimo, i.tipoVenta)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {e !== "ok" && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ESTILO[e]}`}>
                      <Icono nombre="alerta" className="h-3.5 w-3.5" /> {ETIQUETA_ESTADO[e]}
                    </span>
                  )}
                  <span className="w-24 text-right font-semibold tabular-nums">{formatearStock(i.stock, i.tipoVenta)}</span>
                </span>
              </>
            );
            return (
              <li key={i.id} data-stock-item={i.id} data-estado={e} style={{ "--i": Math.min(n, 12) } as React.CSSProperties} className="fx-entra">
                {puedeEditar ? (
                  <Link href={`/stock/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5">{contenido}</Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
