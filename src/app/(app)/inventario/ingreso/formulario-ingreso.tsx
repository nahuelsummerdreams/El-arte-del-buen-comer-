"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { costoPorUnidadDeVenta } from "@/lib/costos";
import { cantidadABase } from "@/lib/inventario";
import { validarMonto } from "@/lib/metas";
import { formatearPesos, type TipoVenta } from "@/lib/precios";
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
export type ProveedorParaIngreso = { id: number; nombre: string };

const campo =
  "w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");

// "use client" porque la etiqueta de cantidad ("kg" o "unidades") y el stock actual cambian según
// el producto elegido. El guardado en sí corre en el servidor.
export function FormularioIngreso({
  productos,
  categorias,
  proveedores,
  claveInicial,
}: {
  productos: ProductoParaIngreso[];
  categorias: Categoria[];
  proveedores: ProveedorParaIngreso[];
  claveInicial: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(registrarIngresoAccion, {
    intento: 0,
    errores: {},
    mensaje: null,
    valores: { productoId: "", cantidad: "", nota: "", clave: claveInicial, costoTotal: "", vence: "", proveedorId: "", pagado: "si", pagarHasta: "" },
  });
  const [elegido, setElegido] = useState(estado.valores.productoId);
  const [cantidadTexto, setCantidadTexto] = useState(estado.valores.cantidad);
  const [costoTexto, setCostoTexto] = useState(estado.valores.costoTotal);
  const [aCuenta, setAcuenta] = useState(estado.valores.pagado === "no");
  const { errores, valores } = estado;
  const producto = productos.find((p) => String(p.id) === elegido);

  // Ayuda en vivo: "equivale a $X el kilo". Es solo una guía; la cuenta que vale la hace la base.
  let equivale: string | null = null;
  if (producto && cantidadTexto.trim() !== "" && costoTexto.trim() !== "") {
    const monto = validarMonto(costoTexto, { permitirCero: true });
    try {
      const base = cantidadABase(cantidadTexto, producto.tipoVenta);
      if (monto.ok) {
        const c = costoPorUnidadDeVenta(monto.centavos, base, producto.tipoVenta);
        if (c !== null) equivale = `${formatearPesos(c)} ${producto.tipoVenta === "peso" ? "el kilo" : "cada unidad"}`;
      }
    } catch {
      /* cantidad todavía incompleta o inválida: el error se muestra al enviar */
    }
  }

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
            onChange={(e) => setCantidadTexto(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={producto?.tipoVenta === "unidad" ? "Ej.: 12" : "Ej.: 2,5"}
            aria-invalid={!!errores.cantidad}
            className={`${campo} ${borde(!!errores.cantidad)}`}
          />
          {errores.cantidad && <p data-error="cantidad" className="text-sm text-red-300">{errores.cantidad}</p>}
        </div>

        <fieldset className="flex flex-col gap-5 rounded-xl border border-crema/10 bg-white/[0.03] p-4">
          <legend className="px-2 text-sm text-crema/70">Costo y vencimiento <span className="text-crema/45">(recomendado)</span></legend>
          <p className="-mt-2 text-sm text-crema/55">
            Con el costo, el panel te muestra cuánto ganás de verdad. Con el vencimiento, te avisa antes de que se pierda mercadería.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="costoTotal" className="text-sm">
              Cuánto pagaste por todo este ingreso <span className="text-crema/50">($)</span>
            </label>
            <input
              id="costoTotal"
              name="costoTotal"
              defaultValue={valores.costoTotal}
              onChange={(e) => setCostoTexto(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ej.: 80.000"
              aria-invalid={!!errores.costoTotal}
              className={`${campo} ${borde(!!errores.costoTotal)}`}
            />
            {equivale && <p data-info="equivale" className="text-sm text-miel">Equivale a {equivale}.</p>}
            {errores.costoTotal && <p data-error="costoTotal" className="text-sm text-red-300">{errores.costoTotal}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="vence" className="text-sm">Vence el</label>
            <input
              id="vence"
              name="vence"
              type="date"
              defaultValue={valores.vence}
              aria-invalid={!!errores.vence}
              className={`${campo} ${borde(!!errores.vence)}`}
            />
            {errores.vence && <p data-error="vence" className="text-sm text-red-300">{errores.vence}</p>}
          </div>

          {proveedores.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="proveedorId" className="text-sm">Proveedor</label>
              <select id="proveedorId" name="proveedorId" defaultValue={valores.proveedorId} className={`${campo} ${borde(!!errores.proveedorId)}`}>
                <option value="">Sin especificar</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {errores.proveedorId && <p data-error="proveedorId" className="text-sm text-red-300">{errores.proveedorId}</p>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm">¿Ya lo pagaste?</span>
            <div className="flex gap-2">
              {[
                { v: "si", t: "Sí, pagado" },
                { v: "no", t: "No, a cuenta" },
              ].map((o) => (
                <label key={o.v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${(o.v === "no") === aCuenta ? "border-crema/60 bg-white/10" : "border-crema/20"}`}>
                  <input type="radio" name="pagado" value={o.v} defaultChecked={(valores.pagado === "no") === (o.v === "no")} onChange={() => setAcuenta(o.v === "no")} />
                  {o.t}
                </label>
              ))}
            </div>
            {errores.pagado && <p data-error="pagado" className="text-sm text-red-300">{errores.pagado}</p>}
          </div>

          {aCuenta && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pagarHasta" className="text-sm">Hay que pagarlo antes del <span className="text-crema/50">(opcional)</span></label>
              <input id="pagarHasta" name="pagarHasta" type="date" defaultValue={valores.pagarHasta} aria-invalid={!!errores.pagarHasta} className={`${campo} ${borde(!!errores.pagarHasta)}`} />
              {errores.pagarHasta && <p data-error="pagarHasta" className="text-sm text-red-300">{errores.pagarHasta}</p>}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota" className="text-sm">
            Nota <span className="text-crema/50">(opcional: número de remito…)</span>
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
