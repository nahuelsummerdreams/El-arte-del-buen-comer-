import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { formatearFechaHora } from "@/lib/fechas";
import { formatearCantidad, formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { enlaceWhatsApp, etiquetaMedio, NOMBRE_NEGOCIO, PIE_COMPROBANTE, textoComprobante } from "@/lib/ticket";
import { Fallo } from "../../_panel/vista-panel";
import { MOTIVOS_ANULACION } from "@/lib/venta";
import { anularVentaAccion } from "./actions";
import { BotonesTicket } from "./botones-ticket";

export default function PaginaTicket(props: PageProps<"/ticket/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 sm:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ params, searchParams }: { params: PageProps<"/ticket/[id]">["params"]; searchParams: PageProps<"/ticket/[id]">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase } = sesion;
  const { id: idCrudo } = await params;
  const q = await searchParams;
  if (!/^\d{1,12}$/.test(idCrudo)) notFound();
  const id = Number(idCrudo);

  // Las reglas de la base hacen que un cajero solo vea SUS ventas y el dueño todas.
  const { data: venta, error } = await supabase
    .from("ventas")
    .select("id, estado, usuario_id, turno_id, total_centavos, subtotal_centavos, descuento_centavos, creado_en, motivo_anulacion")
    .eq("id", id)
    .maybeSingle();
  if (error) return <Fallo texto="No pudimos cargar el comprobante. Intentá de nuevo en un momento." />;
  if (!venta) notFound();

  const esDueno = sesion.perfil.rol === "dueno";
  const [items, pagos, cajero, turno] = await Promise.all([
    supabase.from("venta_items").select("id, producto_id, cantidad, precio_unitario_centavos, subtotal_centavos").eq("venta_id", id).order("id"),
    supabase.from("pagos_venta").select("id, medio, monto_centavos").eq("venta_id", id).order("id"),
    supabase.from("perfiles").select("nombre").eq("id", venta.usuario_id).maybeSingle(),
    esDueno && venta.estado === "completada" ? supabase.from("turnos_caja").select("cerrado_en").eq("id", venta.turno_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const puedeAnular = esDueno && venta.estado === "completada" && !turno.error && turno.data !== null && turno.data.cerrado_en === null;
  if (items.error || pagos.error) return <Fallo texto="No pudimos cargar el comprobante. Intentá de nuevo en un momento." />;
  const ids = items.data.map((i) => i.producto_id);
  const productos = ids.length > 0 ? await supabase.from("productos").select("id, nombre, tipo_venta").in("id", ids) : { data: [], error: null };
  const producto = new Map((productos.data ?? []).map((p) => [p.id, p]));

  const lineas = items.data.map((i) => {
    const p = producto.get(i.producto_id);
    return { nombre: p?.nombre ?? "Producto", tipoVenta: p?.tipo_venta ?? ("unidad" as const), cantidad: i.cantidad, precioUnitarioCentavos: i.precio_unitario_centavos, subtotalCentavos: i.subtotal_centavos };
  });
  const fechaTexto = formatearFechaHora(venta.creado_en);
  const texto = textoComprobante({
    numero: venta.id, fechaTexto, lineas, subtotalCentavos: venta.subtotal_centavos, descuentoCentavos: venta.descuento_centavos,
    totalCentavos: venta.total_centavos, pagos: pagos.data.map((p) => ({ medio: p.medio, montoCentavos: p.monto_centavos })),
  });

  return (
    <>
      <Link href="/" className="no-imprimir text-sm text-crema/60 hover:text-crema">← Panel</Link>
      {q.ok === "anulada" && <p role="status" data-ok className="no-imprimir mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Venta anulada. El stock volvió y ya no cuenta en la caja ni en los reportes.</p>}
      {typeof q.error === "string" && <p role="alert" data-error className="no-imprimir mt-3 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{q.error.slice(0, 200)}</p>}
      {venta.estado === "anulada" && <p role="alert" data-anulada className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">VENTA ANULADA{venta.motivo_anulacion ? ` · ${venta.motivo_anulacion}` : ""}</p>}

      <article data-comprobante={venta.id} className="ticket-impreso fx-entra mt-4 rounded-2xl border border-crema/15 bg-white/[0.04] p-6 text-sm">
        <header className="flex flex-col items-center text-center">
          <Image src="/logo.jpg" alt="" width={754} height={765} className="h-14 w-14 rounded-full object-cover ring-1 ring-crema/25" />
          <h1 className="mt-2 font-display text-xl">{NOMBRE_NEGOCIO}</h1>
          <p className="mt-1 text-xs text-crema/60">Comprobante N.º {venta.id}</p>
          <p className="text-xs text-crema/60">{fechaTexto}{cajero.data?.nombre ? ` · ${cajero.data.nombre}` : ""}</p>
        </header>

        <ul className="mt-4 divide-y divide-dashed divide-crema/20 border-y border-dashed border-crema/20">
          {lineas.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">{l.nombre}</span>
                <span className="text-xs text-crema/60">{formatearCantidad(l.cantidad, l.tipoVenta)} × {formatearPesos(l.precioUnitarioCentavos)}{l.tipoVenta === "peso" ? "/kg" : ""}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatearPesos(l.subtotalCentavos)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-1">
          {venta.descuento_centavos > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-crema/60">Subtotal</dt><dd className="tabular-nums">{formatearPesos(venta.subtotal_centavos)}</dd></div>
              <div className="flex justify-between"><dt className="text-crema/60">Descuento</dt><dd className="tabular-nums">− {formatearPesos(venta.descuento_centavos)}</dd></div>
            </>
          )}
          <div className="flex justify-between text-lg font-semibold"><dt>TOTAL</dt><dd data-total className="tabular-nums">{formatearPesos(venta.total_centavos)}</dd></div>
          {pagos.data.map((p) => (
            <div key={p.id} className="flex justify-between"><dt className="text-crema/60">{etiquetaMedio(p.medio)}</dt><dd className="tabular-nums">{formatearPesos(p.monto_centavos)}</dd></div>
          ))}
        </dl>

        <footer className="mt-5 text-center text-xs text-crema/55">
          <p>¡Gracias por tu compra!</p>
          <p className="mt-1">{PIE_COMPROBANTE}</p>
        </footer>
      </article>

      <BotonesTicket enlaceWhatsApp={enlaceWhatsApp(texto)} />

      {puedeAnular && (
        <details data-anular className="no-imprimir mt-4 rounded-2xl border border-red-400/25 p-4">
          <summary className="cursor-pointer text-sm text-red-300">Anular esta venta…</summary>
          <form action={anularVentaAccion} className="mt-4 space-y-3">
            <input type="hidden" name="ventaId" value={venta.id} />
            <p className="text-sm text-crema/75">Devuelve el stock y saca la venta de la caja y los reportes. No se borra: queda registrada como anulada con tu nombre. Solo se puede mientras la caja siga abierta.</p>
            <label className="block text-sm" htmlFor="motivo-anulacion">Motivo</label>
            <select id="motivo-anulacion" name="motivo" required defaultValue="" className="w-full rounded-lg border border-crema/20 bg-tinta px-3 py-2.5 text-sm">
              <option value="" disabled>Elegí el motivo…</option>
              {MOTIVOS_ANULACION.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input name="detalle" maxLength={120} autoComplete="off" placeholder="Detalle (opcional)" aria-label="Detalle" className="w-full rounded-lg border border-crema/20 bg-white/5 px-3 py-2.5 text-sm" />
            <button type="submit" className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">Sí, anular la venta</button>
          </form>
        </details>
      )}
    </>
  );
}
