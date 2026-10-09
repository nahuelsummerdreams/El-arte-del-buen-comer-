"use client";

import { useActionState, useState } from "react";
import { MOTIVOS_MERMA } from "@/lib/inventario";
import type { TipoVenta } from "@/lib/precios";
import { registrarMermaAccion, type EstadoMerma } from "./actions";

export type ProductoParaMerma = { id: number; nombre: string; tipoVenta: TipoVenta; categoriaId: number; stockTexto: string };
type Categoria = { id: number; nombre: string };

const campo = "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");

export function FormularioMerma({ productos, categorias, claveInicial }: { productos: ProductoParaMerma[]; categorias: Categoria[]; claveInicial: string }) {
  const [estado, accion, enviando] = useActionState<EstadoMerma, FormData>(registrarMermaAccion, {
    intento: 0,
    errores: {},
    mensaje: null,
    valores: { productoId: "", cantidad: "", motivo: "", detalle: "", clave: claveInicial },
  });
  const [elegido, setElegido] = useState(estado.valores.productoId);
  const { errores, valores } = estado;
  const producto = productos.find((p) => String(p.id) === elegido);

  return (
    <form action={accion} className="flex w-full flex-col gap-5" noValidate>
      <input type="hidden" name="clave" value={claveInicial} />

      {estado.mensaje && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>
      )}
      {errores.clave && (
        <p role="alert" data-error="clave" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{errores.clave}</p>
      )}

      <div key={estado.intento} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="productoId" className="text-sm">Producto</label>
          <select id="productoId" name="productoId" defaultValue={valores.productoId} onChange={(e) => setElegido(e.target.value)} aria-invalid={!!errores.productoId} className={`${campo} ${borde(!!errores.productoId)}`}>
            <option value="">Elegí un producto…</option>
            {categorias.map((c) => {
              const lista = productos.filter((p) => p.categoriaId === c.id);
              return lista.length === 0 ? null : (
                <optgroup key={c.id} label={c.nombre}>
                  {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </optgroup>
              );
            })}
          </select>
          {producto && <p data-info="stock" className="text-sm text-crema/60">Stock actual: {producto.stockTexto}</p>}
          {errores.productoId && <p data-error="productoId" className="text-sm text-red-300">{errores.productoId}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cantidad" className="text-sm">
            {producto === undefined ? "Cantidad perdida" : producto.tipoVenta === "peso" ? "Cantidad perdida (kg)" : "Cantidad perdida (unidades)"}
          </label>
          <input id="cantidad" name="cantidad" defaultValue={valores.cantidad} inputMode="decimal" autoComplete="off" placeholder={producto?.tipoVenta === "unidad" ? "Ej.: 3" : "Ej.: 0,5"} aria-invalid={!!errores.cantidad} className={`${campo} ${borde(!!errores.cantidad)}`} />
          {errores.cantidad && <p data-error="cantidad" className="text-sm text-red-300">{errores.cantidad}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="motivo" className="text-sm">¿Qué pasó?</label>
          <select id="motivo" name="motivo" defaultValue={valores.motivo} aria-invalid={!!errores.motivo} className={`${campo} ${borde(!!errores.motivo)}`}>
            <option value="">Elegí el motivo…</option>
            {MOTIVOS_MERMA.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {errores.motivo && <p data-error="motivo" className="text-sm text-red-300">{errores.motivo}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="detalle" className="text-sm">Detalle <span className="text-crema/50">(opcional)</span></label>
          <input id="detalle" name="detalle" defaultValue={valores.detalle} maxLength={120} autoComplete="off" aria-invalid={!!errores.detalle} className={`${campo} ${borde(!!errores.detalle)}`} />
          {errores.detalle && <p data-error="detalle" className="text-sm text-red-300">{errores.detalle}</p>}
        </div>
      </div>

      <div className="pt-2">
        <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60">
          {enviando ? "Registrando…" : "Registrar pérdida"}
        </button>
      </div>
    </form>
  );
}
