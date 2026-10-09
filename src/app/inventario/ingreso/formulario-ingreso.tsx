"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TipoVenta } from "@/lib/precios";
import { registrarIngresoAccion, type EstadoIngreso } from "./actions";

export type ProductoParaIngreso = {
  id: number;
  nombre: string;
  tipoVenta: TipoVenta;
  categoriaId: number;
  /** Ya formateado en el servidor ("2,5 kg", "12 u."). */
  stockTexto: string;
};
type Categoria = { id: number; nombre: string };

const campo =
  "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");

// "use client" porque la etiqueta de cantidad ("kg" o "unidades") y el stock actual cambian según
// el producto elegido. El guardado en sí corre en el servidor.
export function FormularioIngreso({
  productos,
  categorias,
  claveInicial,
}: {
  productos: ProductoParaIngreso[];
  categorias: Categoria[];
  claveInicial: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(registrarIngresoAccion, {
    intento: 0,
    errores: {},
    mensaje: null,
    valores: { productoId: "", cantidad: "", nota: "", clave: claveInicial },
  });
  const [elegido, setElegido] = useState(estado.valores.productoId);
  const { errores, valores } = estado;
  const producto = productos.find((p) => String(p.id) === elegido);

  return (
    <form action={accion} className="flex w-full flex-col gap-5" noValidate>
      {/* Código único de ESTE formulario: si llegara dos veces, el stock se suma una sola vez. */}
      <input type="hidden" name="clave" value={claveInicial} />

      {estado.mensaje && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {estado.mensaje}
        </p>
      )}
      {errores.clave && (
        <p role="alert" data-error="clave" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {errores.clave}
        </p>
      )}

      {/* key={estado.intento}: ver el comentario en actions.ts (React 19 reinicia el formulario). */}
      <div key={estado.intento} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="productoId" className="text-sm">Producto</label>
          <select
            id="productoId"
            name="productoId"
            defaultValue={valores.productoId}
            onChange={(e) => setElegido(e.target.value)}
            aria-invalid={!!errores.productoId}
            className={`${campo} ${borde(!!errores.productoId)}`}
          >
            <option value="">Elegí un producto…</option>
            {categorias.map((c) => {
              const deEstaCategoria = productos.filter((p) => p.categoriaId === c.id);
              if (deEstaCategoria.length === 0) return null;
              return (
                <optgroup key={c.id} label={c.nombre}>
                  {deEstaCategoria.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {producto && (
            <p data-info="stock" className="text-sm text-crema/60">
              Stock actual: {producto.stockTexto} · se vende {producto.tipoVenta === "peso" ? "por peso" : "por unidad"}
            </p>
          )}
          {errores.productoId && <p data-error="productoId" className="text-sm text-red-300">{errores.productoId}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cantidad" className="text-sm">
            {producto === undefined ? "Cantidad" : producto.tipoVenta === "peso" ? "Cantidad (kg)" : "Cantidad (unidades)"}
          </label>
          <input
            id="cantidad"
            name="cantidad"
            defaultValue={valores.cantidad}
            inputMode="decimal"
            autoComplete="off"
            placeholder={producto?.tipoVenta === "unidad" ? "Ej.: 12" : "Ej.: 2,5"}
            aria-invalid={!!errores.cantidad}
            className={`${campo} ${borde(!!errores.cantidad)}`}
          />
          {errores.cantidad && <p data-error="cantidad" className="text-sm text-red-300">{errores.cantidad}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota" className="text-sm">
            Nota <span className="text-crema/50">(opcional: proveedor, número de remito…)</span>
          </label>
          <input
            id="nota"
            name="nota"
            defaultValue={valores.nota}
            maxLength={200}
            autoComplete="off"
            aria-invalid={!!errores.nota}
            className={`${campo} ${borde(!!errores.nota)}`}
          />
          {errores.nota && <p data-error="nota" className="text-sm text-red-300">{errores.nota}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60"
        >
          {enviando ? "Registrando…" : "Registrar ingreso"}
        </button>
        <Link href="/productos" className="px-3 py-2.5 text-sm text-crema/70 hover:text-crema">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
