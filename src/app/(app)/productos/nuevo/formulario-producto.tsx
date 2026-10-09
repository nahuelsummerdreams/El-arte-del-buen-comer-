"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearProductoAccion, type EstadoProducto } from "./actions";

type Categoria = { id: number; nombre: string };

const estadoInicial: EstadoProducto = {
  intento: 0,
  errores: {},
  mensaje: null,
  valores: { nombre: "", categoriaId: "", tipoVenta: "peso", precio: "", codigo: "" },
};

const campo =
  "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");

// "use client" porque el texto del precio cambia según el tipo elegido (estado en el navegador).
// El guardado en sí corre en el servidor (crearProductoAccion).
export function FormularioProducto({ categorias }: { categorias: Categoria[] }) {
  const [estado, accion, enviando] = useActionState(crearProductoAccion, estadoInicial);
  const [tipo, setTipo] = useState(estado.valores.tipoVenta === "unidad" ? "unidad" : "peso");
  const { errores, valores } = estado;

  return (
    <form action={accion} className="flex w-full flex-col gap-5" noValidate>
      {estado.mensaje && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {estado.mensaje}
        </p>
      )}

      {/* key={estado.intento}: ver el comentario de EstadoProducto.intento en actions.ts */}
      <div key={estado.intento} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nombre" className="text-sm">Nombre</label>
        <input
          id="nombre"
          name="nombre"
          defaultValue={valores.nombre}
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!errores.nombre}
          className={`${campo} ${borde(!!errores.nombre)}`}
        />
        {errores.nombre && <p data-error="nombre" className="text-sm text-red-300">{errores.nombre}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoriaId" className="text-sm">Categoría</label>
        <select
          id="categoriaId"
          name="categoriaId"
          defaultValue={valores.categoriaId}
          aria-invalid={!!errores.categoriaId}
          className={`${campo} ${borde(!!errores.categoriaId)}`}
        >
          <option value="">Elegí una categoría…</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        {errores.categoriaId && <p data-error="categoriaId" className="text-sm text-red-300">{errores.categoriaId}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">¿Cómo se vende?</legend>
        <div className="grid grid-cols-2 gap-3">
          {[
            { valor: "peso", titulo: "Por peso", detalle: "se pesa y se vende por kilo" },
            { valor: "unidad", titulo: "Por unidad", detalle: "se vende de a uno" },
          ].map((o) => (
            <label
              key={o.valor}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition ${
                tipo === o.valor ? "border-crema bg-white/10" : "border-crema/20 hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="tipoVenta"
                value={o.valor}
                checked={tipo === o.valor}
                onChange={() => setTipo(o.valor)}
                className="sr-only"
              />
              <span className="block font-medium">{o.titulo}</span>
              <span className="block text-crema/60">{o.detalle}</span>
            </label>
          ))}
        </div>
        {errores.tipoVenta && <p data-error="tipoVenta" className="text-sm text-red-300">{errores.tipoVenta}</p>}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="precio" className="text-sm">
          {tipo === "peso" ? "Precio por kilo ($)" : "Precio por unidad ($)"}
        </label>
        <input
          id="precio"
          name="precio"
          defaultValue={valores.precio}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ej.: 20.000,50"
          aria-invalid={!!errores.precio}
          className={`${campo} ${borde(!!errores.precio)}`}
        />
        {errores.precio && <p data-error="precio" className="text-sm text-red-300">{errores.precio}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo" className="text-sm">
          Código <span className="text-crema/50">(opcional)</span>
        </label>
        <input
          id="codigo"
          name="codigo"
          defaultValue={valores.codigo}
          maxLength={40}
          autoComplete="off"
          aria-invalid={!!errores.codigo}
          className={`${campo} ${borde(!!errores.codigo)}`}
        />
        {errores.codigo && <p data-error="codigo" className="text-sm text-red-300">{errores.codigo}</p>}
      </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar producto"}
        </button>
        <Link href="/productos" className="px-3 py-2.5 text-sm text-crema/70 hover:text-crema">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
