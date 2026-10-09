"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { TipoVenta } from "@/lib/precios";
import { editarProductoAccion, type EstadoEdicion, type ValoresEdicion } from "./actions";

const campo = "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-miel";
const borde = (e: boolean) => (e ? "border-red-400/70" : "border-crema/20");

export function FormularioEdicion({ inicial, categorias, tipoVenta }: { inicial: ValoresEdicion; categorias: { id: number; nombre: string }[]; tipoVenta: TipoVenta }) {
  const [estado, accion, enviando] = useActionState<EstadoEdicion, FormData>(editarProductoAccion, { intento: 0, errores: {}, mensaje: null, valores: inicial });
  const { errores, valores } = estado;
  return (
    <form action={accion} noValidate className="space-y-5">
      <input type="hidden" name="productoId" value={valores.productoId} />
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}

      <div key={estado.intento} className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={valores.nombre} maxLength={80} autoComplete="off" aria-invalid={!!errores.nombre} className={`${campo} ${borde(!!errores.nombre)}`} />
          {errores.nombre && <p data-error="nombre" className="text-sm text-red-300">{errores.nombre}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoriaId" className="text-sm">Categoría</label>
          <select id="categoriaId" name="categoriaId" defaultValue={valores.categoriaId} aria-invalid={!!errores.categoriaId} className={`${campo} ${borde(!!errores.categoriaId)}`}>
            <option value="">Elegí una categoría…</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {errores.categoriaId && <p data-error="categoriaId" className="text-sm text-red-300">{errores.categoriaId}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm">Se vende</span>
          <p className="rounded-lg border border-crema/10 bg-white/[0.03] px-3 py-2.5 text-sm text-crema/75">
            {tipoVenta === "peso" ? "Por peso (kilos)" : "Por unidad"} <span className="text-crema/50">· no se puede cambiar: el historial de stock y ventas está en esa unidad. Si hace falta, archivá este producto y creá otro.</span>
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="precio" className="text-sm">Precio {tipoVenta === "peso" ? "por kilo" : "por unidad"} ($)</label>
            <input id="precio" name="precio" defaultValue={valores.precio} inputMode="decimal" autoComplete="off" aria-invalid={!!errores.precio} className={`${campo} ${borde(!!errores.precio)}`} />
            {errores.precio && <p data-error="precio" className="text-sm text-red-300">{errores.precio}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stockMinimo" className="text-sm">Stock mínimo {tipoVenta === "peso" ? "(kg)" : "(unidades)"} <span className="text-crema/50">(opcional)</span></label>
            <input id="stockMinimo" name="stockMinimo" defaultValue={valores.stockMinimo} inputMode="decimal" autoComplete="off" placeholder="Sin mínimo" aria-invalid={!!errores.stockMinimo} className={`${campo} ${borde(!!errores.stockMinimo)}`} />
            <p className="text-xs text-crema/50">Cuando el stock llega a esta cantidad, aparece en «Para reponer».</p>
            {errores.stockMinimo && <p data-error="stockMinimo" className="text-sm text-red-300">{errores.stockMinimo}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo" className="text-sm">Código <span className="text-crema/50">(opcional)</span></label>
          <input id="codigo" name="codigo" defaultValue={valores.codigo} maxLength={40} autoComplete="off" aria-invalid={!!errores.codigo} className={`${campo} ${borde(!!errores.codigo)}`} />
          {errores.codigo && <p data-error="codigo" className="text-sm text-red-300">{errores.codigo}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={enviando} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60">{enviando ? "Guardando…" : "Guardar cambios"}</button>
        <Link href={`/stock/${valores.productoId}`} className="px-3 py-2.5 text-sm text-crema/70 hover:text-crema">Cancelar</Link>
      </div>
    </form>
  );
}
