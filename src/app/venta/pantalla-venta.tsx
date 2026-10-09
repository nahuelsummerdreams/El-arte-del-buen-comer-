"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MEDIOS_DE_PAGO, type MedioPago } from "@/lib/caja";
import { formatearCantidad, formatearPesos, pesosACentavos } from "@/lib/precios";
import {
  agregarAlCarrito,
  armarVenta,
  calcularVuelto,
  cambiarCantidad,
  leerKilos,
  quitarDelCarrito,
  subtotalCarrito,
  validarDescuento,
  type LineaCarrito,
  type ProductoVendible,
} from "@/lib/venta";
import { registrarVentaAccion, type EstadoVenta } from "./actions";

export type ProductoParaVenta = ProductoVendible & {
  categoriaId: number;
  stock: number;
  /** Ya formateado en el servidor ("2,5 kg", "12 u."). */
  stockTexto: string;
};
type Categoria = { id: number; nombre: string };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const CANTIDADES_RAPIDAS = [
  { gramos: 100, etiqueta: "100 g" },
  { gramos: 250, etiqueta: "250 g" },
  { gramos: 500, etiqueta: "½ kg" },
  { gramos: 1000, etiqueta: "1 kg" },
];

// "use client": el carrito vive en el navegador mientras se arma la venta. Al cobrar se manda al
// servidor SOLO qué producto y cuánto (nunca precios); la base calcula y verifica todo.
export function PantallaVenta({
  productos,
  categorias,
  esDueno,
  claveInicial,
}: {
  productos: ProductoParaVenta[];
  categorias: Categoria[];
  esDueno: boolean;
  claveInicial: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<number | null>(null);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [pesando, setPesando] = useState<{ producto: ProductoParaVenta; reemplazar: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [descuentoTexto, setDescuentoTexto] = useState("");
  const [recibidoTexto, setRecibidoTexto] = useState("");
  const [estado, accion, enviando] = useActionState<EstadoVenta, FormData>(registrarVentaAccion, { intento: 0, mensaje: null });

  // El React Compiler del proyecto memoriza estos cálculos solo: no hace falta useMemo a mano.
  const q = sinAcentos(busqueda.trim());
  const visibles = productos.filter(
    (p) => (categoria === null || p.categoriaId === categoria) && (q === "" || sinAcentos(p.nombre).includes(q)),
  );

  // ---- importes (solo para MOSTRAR; el servidor recalcula todo con los precios de la base) ----
  const subtotal = subtotalCarrito(carrito);
  const descuento = esDueno ? validarDescuento(descuentoTexto, subtotal) : ({ ok: true, centavos: 0 } as const);
  const descuentoCentavos = descuento.ok ? descuento.centavos : 0;
  const total = subtotal - descuentoCentavos;
  let envio: ReturnType<typeof armarVenta> | null = null;
  if (descuento.ok) {
    try {
      envio = armarVenta(carrito, medio, descuentoCentavos);
    } catch {
      envio = null; // carrito vacío o total en cero: todavía no se puede cobrar
    }
  }
  const puedeCobrar = envio !== null && !enviando;

  let vuelto: ReturnType<typeof calcularVuelto> | null = null;
  if (medio === "efectivo" && recibidoTexto.trim() !== "" && total > 0) {
    try {
      vuelto = calcularVuelto(total, pesosACentavos(recibidoTexto));
    } catch {
      vuelto = null;
    }
  }

  // ---- acciones sobre el carrito ----
  function intentar(accion: () => LineaCarrito[], mensajeError: string) {
    try {
      setCarrito(accion());
      setAviso(null);
    } catch {
      setAviso(mensajeError);
    }
  }
  const tocar = (p: ProductoParaVenta) => {
    if (p.tipoVenta === "peso") setPesando({ producto: p, reemplazar: false });
    else intentar(() => agregarAlCarrito(carrito, p, 1), `No se puede agregar más de «${p.nombre}».`);
  };
  const aceptarPeso = (gramos: number) => {
    if (!pesando) return;
    const { producto, reemplazar } = pesando;
    intentar(
      () => (reemplazar ? cambiarCantidad(carrito, producto.id, gramos) : agregarAlCarrito(carrito, producto, gramos)),
      `No se puede agregar esa cantidad de «${producto.nombre}».`,
    );
    setPesando(null);
  };

  const cantidadEnCarrito = carrito.length;

  return (
    <div className="pb-28 lg:pb-0">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-crema/60 hover:text-crema">← Panel</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Venta</h1>
        <span className="w-12" aria-hidden />
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6">
        {/* ------------------------------------------------------------------ productos */}
        <section aria-label="Productos">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className="w-full rounded-xl border border-crema/20 bg-white/5 px-4 py-3 text-base outline-none focus:border-crema/60"
          />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorías">
            {[{ id: null, nombre: "Todos" }, ...categorias].map((c) => (
              <button
                key={c.id ?? "todos"}
                type="button"
                onClick={() => setCategoria(c.id)}
                aria-pressed={categoria === c.id}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                  categoria === c.id ? "border-crema bg-crema text-tinta" : "border-crema/25 hover:bg-white/5"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? (
            <p className="mt-8 text-center text-crema/60">
              {productos.length === 0 ? "No hay productos con precio para vender." : "Ningún producto coincide con la búsqueda."}
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-producto={p.id}
                    onClick={() => tocar(p)}
                    className="flex min-h-[96px] w-full flex-col justify-between rounded-xl border border-crema/15 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08] active:scale-[0.98]"
                  >
                    <span className="font-medium leading-snug">{p.nombre}</span>
                    <span>
                      <span className="block text-lg font-semibold tabular-nums">
                        {formatearPesos(p.precioCentavos)}
                        <span className="text-xs font-normal text-crema/60"> {p.tipoVenta === "peso" ? "/kg" : "/u."}</span>
                      </span>
                      <span className={`block text-xs ${p.stock <= 0 ? "text-red-300" : "text-crema/50"}`}>
                        {p.stock <= 0 ? "Sin stock" : `Quedan ${p.stockTexto}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* -------------------------------------------------------------------- carrito */}
        <aside id="carrito" aria-label="Carrito" className="mt-8 lg:sticky lg:top-4 lg:mt-0 lg:self-start">
          <div className="rounded-2xl border border-crema/15 bg-white/[0.04] p-4">
            <h2 className="mb-3 text-lg font-medium">Carrito{cantidadEnCarrito > 0 ? ` (${cantidadEnCarrito})` : ""}</h2>

            {aviso && <p role="alert" className="mb-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{aviso}</p>}

            {cantidadEnCarrito === 0 ? (
              <p className="py-8 text-center text-sm text-crema/50">Tocá un producto para agregarlo.</p>
            ) : (
              <ul className="divide-y divide-crema/10">
                {carrito.map((l) => (
                  <li key={l.producto.id} data-linea={l.producto.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">{l.producto.nombre}</p>
                      <button
                        type="button"
                        onClick={() => setCarrito(quitarDelCarrito(carrito, l.producto.id))}
                        aria-label={`Quitar ${l.producto.nombre}`}
                        className="-mr-1 shrink-0 rounded-md px-2 py-0.5 text-lg leading-none text-crema/50 hover:bg-white/5 hover:text-crema"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      {l.producto.tipoVenta === "unidad" ? (
                        <span className="inline-flex items-center gap-1">
                          <button type="button" aria-label="Menos" onClick={() => intentar(() => cambiarCantidad(carrito, l.producto.id, l.cantidad - 1), "")}
                            className="h-9 w-9 rounded-lg border border-crema/25 text-lg hover:bg-white/5">−</button>
                          <span data-cantidad className="w-10 text-center tabular-nums">{l.cantidad}</span>
                          <button type="button" aria-label="Más" onClick={() => intentar(() => agregarAlCarrito(carrito, l.producto, 1), `No se puede agregar más de «${l.producto.nombre}».`)}
                            className="h-9 w-9 rounded-lg border border-crema/25 text-lg hover:bg-white/5">+</button>
                        </span>
                      ) : (
                        <button type="button" data-cantidad onClick={() => setPesando({ producto: l.producto as ProductoParaVenta, reemplazar: true })}
                          className="rounded-lg border border-crema/25 px-3 py-1.5 text-sm hover:bg-white/5">
                          {formatearCantidad(l.cantidad, "peso")} <span className="text-crema/50">✎</span>
                        </button>
                      )}
                      <span data-subtotal-linea className="tabular-nums">{formatearPesos(subtotalCarrito([l]))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {cantidadEnCarrito > 0 && (
              <div className="mt-3 space-y-3 border-t border-crema/10 pt-3">
                {esDueno && (
                  <div>
                    <label htmlFor="descuento" className="text-sm text-crema/80">Descuento ($) <span className="text-crema/50">(solo dueño)</span></label>
                    <input
                      id="descuento" value={descuentoTexto} onChange={(e) => setDescuentoTexto(e.target.value)}
                      inputMode="decimal" autoComplete="off" placeholder="Ej.: 500"
                      className={`mt-1 w-full rounded-lg border bg-white/5 px-3 py-2 outline-none focus:border-crema/60 ${descuento.ok ? "border-crema/20" : "border-red-400/70"}`}
                    />
                    {!descuento.ok && <p data-error="descuento" className="mt-1 text-sm text-red-300">{descuento.error}</p>}
                  </div>
                )}

                {(descuentoCentavos > 0 || esDueno) && (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-crema/60">Subtotal</dt><dd className="tabular-nums">{formatearPesos(subtotal)}</dd></div>
                    {descuentoCentavos > 0 && (
                      <div className="flex justify-between"><dt className="text-crema/60">Descuento</dt><dd className="tabular-nums">− {formatearPesos(descuentoCentavos)}</dd></div>
                    )}
                  </dl>
                )}

                <p className="flex items-baseline justify-between">
                  <span className="text-lg">Total</span>
                  <span data-total className="text-3xl font-semibold tabular-nums">{formatearPesos(total)}</span>
                </p>

                <div role="group" aria-label="Medio de pago" className="grid grid-cols-2 gap-2">
                  {MEDIOS_DE_PAGO.map((m) => (
                    <button
                      key={m.valor} type="button" data-medio={m.valor}
                      onClick={() => setMedio(m.valor)} aria-pressed={medio === m.valor}
                      className={`rounded-lg border px-3 py-2.5 text-sm transition ${medio === m.valor ? "border-crema bg-crema font-medium text-tinta" : "border-crema/25 hover:bg-white/5"}`}
                    >
                      {m.etiqueta}
                    </button>
                  ))}
                </div>

                {medio === "efectivo" && (
                  <div>
                    <label htmlFor="recibido" className="text-sm text-crema/80">¿Con cuánto paga? <span className="text-crema/50">(para calcular el vuelto)</span></label>
                    <input
                      id="recibido" value={recibidoTexto} onChange={(e) => setRecibidoTexto(e.target.value)}
                      inputMode="decimal" autoComplete="off" placeholder="Ej.: 20.000"
                      className="mt-1 w-full rounded-lg border border-crema/20 bg-white/5 px-3 py-2 outline-none focus:border-crema/60"
                    />
                    {vuelto && vuelto.ok && (
                      <p data-vuelto className="mt-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-center text-lg text-emerald-200">
                        Vuelto: <strong className="tabular-nums">{formatearPesos(vuelto.vuelto)}</strong>
                      </p>
                    )}
                    {vuelto && !vuelto.ok && (
                      <p data-vuelto className="mt-2 rounded-lg bg-red-400/10 px-3 py-2 text-center text-red-200">
                        Faltan <strong className="tabular-nums">{formatearPesos(vuelto.falta)}</strong>
                      </p>
                    )}
                  </div>
                )}

                {estado.mensaje && <p role="alert" data-error="venta" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}

                {/* El formulario lleva SOLO lo que el servidor necesita: producto, cantidad, medio y el total
                    que ve el cajero (el servidor lo usa para confirmar que el precio no cambió). */}
                <form action={accion}>
                  <input type="hidden" name="items" value={JSON.stringify(envio?.items ?? [])} />
                  <input type="hidden" name="medio" value={medio} />
                  <input type="hidden" name="total" value={String(envio?.pagos[0].monto ?? 0)} />
                  <input type="hidden" name="descuento" value={String(descuentoCentavos)} />
                  <input type="hidden" name="clave" value={claveInicial} />
                  <button
                    type="submit" disabled={!puedeCobrar}
                    className="w-full rounded-xl bg-crema px-5 py-4 text-lg font-semibold text-tinta shadow-lg shadow-black/30 transition hover:bg-crema/90 active:scale-[0.99] disabled:opacity-50"
                  >
                    {enviando ? "Cobrando…" : `Cobrar ${formatearPesos(total)}`}
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Barra fija en el celular: total siempre a la vista y salto al carrito. */}
      {cantidadEnCarrito > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-crema/15 bg-tinta/95 p-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => document.getElementById("carrito")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex w-full items-center justify-between rounded-xl bg-crema px-5 py-3.5 font-semibold text-tinta"
          >
            <span>Ver carrito ({cantidadEnCarrito})</span>
            <span className="tabular-nums">{formatearPesos(total)}</span>
          </button>
        </div>
      )}

      {pesando && (
        <DialogoPeso
          key={`${pesando.producto.id}-${pesando.reemplazar}`}
          producto={pesando.producto}
          reemplazar={pesando.reemplazar}
          onAceptar={aceptarPeso}
          onCerrar={() => setPesando(null)}
        />
      )}
    </div>
  );
}

function DialogoPeso({
  producto,
  reemplazar,
  onAceptar,
  onCerrar,
}: {
  producto: ProductoParaVenta;
  reemplazar: boolean;
  onAceptar: (gramos: number) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  function aceptarEscrito() {
    const r = leerKilos(texto);
    if (!r.ok) return setError(r.error);
    onAceptar(r.gramos);
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Cantidad de ${producto.nombre}`}
      onKeyDown={(e) => e.key === "Escape" && onCerrar()}
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl border border-crema/20 bg-tinta p-5 shadow-2xl">
        <p className="text-sm text-crema/60">{reemplazar ? "Cambiar cantidad de" : "¿Cuánto llevás de"}</p>
        <h2 className="mb-1 text-xl font-semibold">{producto.nombre}</h2>
        <p className="mb-4 text-sm text-crema/60">{formatearPesos(producto.precioCentavos)} el kilo</p>

        <div className="grid grid-cols-4 gap-2">
          {CANTIDADES_RAPIDAS.map((c) => (
            <button key={c.gramos} type="button" data-rapida={c.gramos} onClick={() => onAceptar(c.gramos)}
              className="rounded-lg border border-crema/25 py-3 text-sm font-medium hover:bg-white/5">
              {c.etiqueta}
            </button>
          ))}
        </div>

        <label htmlFor="kilos" className="mt-4 block text-sm text-crema/80">Otra cantidad (kilos)</label>
        <input
          id="kilos" autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && aceptarEscrito()}
          inputMode="decimal" autoComplete="off" placeholder="Ej.: 0,350"
          className={`mt-1 w-full rounded-lg border bg-white/5 px-3 py-3 text-base outline-none focus:border-crema/60 ${error ? "border-red-400/70" : "border-crema/20"}`}
        />
        {error && <p data-error="kilos" className="mt-1 text-sm text-red-300">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={aceptarEscrito} className="flex-1 rounded-lg bg-crema px-4 py-3 font-medium text-tinta">
            {reemplazar ? "Cambiar" : "Agregar"}
          </button>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-crema/25 px-4 py-3 hover:bg-white/5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
