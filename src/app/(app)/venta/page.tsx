import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MEDIOS_DE_PAGO } from "@/lib/caja";
import { formatearFechaHora } from "@/lib/fechas";
import { formatearCantidad, formatearPesos, formatearStock } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { PantallaVenta, type ProductoParaVenta } from "./pantalla-venta";

export default function PaginaVenta(props: PageProps<"/venta">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/venta">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase, perfil } = sesion;
  const q = await searchParams;

  // ----------------------------------------------------- venta recién registrada (ticket)
  const okId = typeof q.ok === "string" && /^\d{1,15}$/.test(q.ok) ? Number(q.ok) : null;
  if (okId !== null) return <Ticket ventaId={okId} />;

  // --------------------------------------------------------------- hace falta caja abierta
  const { data: turno } = await supabase.from("turnos_caja").select("id").is("cerrado_en", null).maybeSingle();
  if (!turno) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-crema/20 px-6 py-12 text-center">
        <p className="text-xl">Primero abrí la caja</p>
        <p className="mt-1 text-sm text-crema/60">Cada venta queda registrada dentro de un turno de caja.</p>
        <Link href="/caja" className="mt-5 inline-block rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta">Ir a Caja</Link>
      </div>
    );
  }

  // ---------------------------------------------------------------- pantalla de venta
  const [productos, categorias, stocks] = await Promise.all([
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, categoria_id, precio_centavos").eq("activo", true),
    supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
    supabase.from("stock_actual").select("producto_id, stock"),
  ]);
  if (productos.error || categorias.error || stocks.error) {
    return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">No pudimos cargar los productos. Intentá de nuevo en un momento.</p>;
  }

  const stockDe = new Map(stocks.data.map((s) => [s.producto_id, s.stock ?? 0]));
  const lista: ProductoParaVenta[] = productos.data
    .flatMap((p) =>
      p.id !== null && p.nombre !== null && p.tipo_venta !== null && p.categoria_id !== null && p.precio_centavos !== null
        ? [{
            id: p.id, nombre: p.nombre, tipoVenta: p.tipo_venta, categoriaId: p.categoria_id,
            precioCentavos: p.precio_centavos, stock: stockDe.get(p.id) ?? 0,
            stockTexto: formatearStock(stockDe.get(p.id) ?? 0, p.tipo_venta),
          }]
        : [],
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Un código único por cada vez que se arma una venta nueva (idempotencia): si el envío se repite,
  // la base cobra una sola vez. Se genera acá, en el servidor, para que cliente y servidor coincidan.
  // La `key` hace que, tras cada venta, la pantalla arranque de cero con un código nuevo.
  const clave = crypto.randomUUID();

  return (
    <PantallaVenta
      key={clave}
      productos={lista}
      categorias={categorias.data}
      esDueno={perfil.rol === "dueno"}
      claveInicial={clave}
    />
  );
}

async function Ticket({ ventaId }: { ventaId: number }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase } = sesion;

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total_centavos, subtotal_centavos, descuento_centavos, creado_en")
    .eq("id", ventaId)
    .maybeSingle();

  if (!venta) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-lg">No encontramos esa venta.</p>
        <Link href="/venta" className="mt-4 inline-block underline underline-offset-4">Nueva venta</Link>
      </div>
    );
  }

  const [items, pagos] = await Promise.all([
    supabase.from("venta_items").select("id, producto_id, cantidad, precio_unitario_centavos, subtotal_centavos").eq("venta_id", venta.id).order("id"),
    supabase.from("pagos_venta").select("id, medio, monto_centavos").eq("venta_id", venta.id).order("id"),
  ]);
  const ids = (items.data ?? []).map((i) => i.producto_id);
  const productos = ids.length > 0 ? await supabase.from("productos").select("id, nombre, tipo_venta").in("id", ids) : { data: [] };
  const producto = new Map((productos.data ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-md" data-ticket={venta.id}>
      <div role="status" className="mb-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-4 text-emerald-100">
        <p className="text-lg font-semibold">Venta registrada ✓</p>
        <p className="text-sm text-emerald-100/80">N.º {venta.id} · {formatearFechaHora(venta.creado_en)}</p>
      </div>

      <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-5">
        <ul className="divide-y divide-crema/10 text-sm">
          {(items.data ?? []).map((i) => {
            const p = producto.get(i.producto_id);
            return (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{p?.nombre ?? "Producto"}</span>
                  <span className="text-crema/60">
                    {p ? formatearCantidad(i.cantidad, p.tipo_venta) : i.cantidad} × {formatearPesos(i.precio_unitario_centavos)}{p?.tipo_venta === "peso" ? "/kg" : ""}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatearPesos(i.subtotal_centavos)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-crema/10 pt-3 text-sm">
          {venta.descuento_centavos > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-crema/60">Subtotal</dt><dd className="tabular-nums">{formatearPesos(venta.subtotal_centavos)}</dd></div>
              <div className="flex justify-between"><dt className="text-crema/60">Descuento</dt><dd className="tabular-nums">− {formatearPesos(venta.descuento_centavos)}</dd></div>
            </>
          )}
          <div className="flex justify-between text-xl font-semibold"><dt>Total</dt><dd data-total className="tabular-nums">{formatearPesos(venta.total_centavos)}</dd></div>
          {(pagos.data ?? []).map((p) => (
            <div key={p.id} className="flex justify-between"><dt className="text-crema/60">{MEDIOS_DE_PAGO.find((m) => m.valor === p.medio)?.etiqueta}</dt><dd className="tabular-nums">{formatearPesos(p.monto_centavos)}</dd></div>
          ))}
        </dl>
      </div>

      <Link href={`/ticket/${venta.id}`} data-ver-comprobante className="mt-5 block rounded-lg border border-crema/30 px-5 py-3 text-center font-medium transition hover:bg-white/5">
        Comprobante: imprimir o mandar por WhatsApp
      </Link>
      <Link href="/venta" className="mt-3 block rounded-lg bg-crema px-5 py-3.5 text-center text-lg font-medium text-tinta shadow-lg shadow-black/30">
        Nueva venta
      </Link>
      <Link href="/" className="mt-3 block text-center text-sm text-crema/60 hover:text-crema">← Panel</Link>
    </div>
  );
}
