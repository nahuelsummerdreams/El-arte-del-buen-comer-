import { redirect } from "next/navigation";
import { Suspense } from "react";
import { leerVencimientos } from "@/lib/costos";
import { armarOfertas, precioAnteriorDeOferta, VENTANA_OFERTAS_DIAS } from "@/lib/ofertas";
import { obtenerSesion } from "@/lib/sesion";
import { Fallo } from "../_panel/vista-panel";
import { TarjetaOferta } from "./tarjeta-oferta";

export default function PaginaOfertas(props: PageProps<"/ofertas">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Ofertas por vencimiento</h1>
      <p className="mb-6 mt-2 text-sm text-crema/60">Lo que está por vencerse, con el descuento que conviene para venderlo antes de perderlo.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const ERRORES: Record<string, string> = {
  datos: "El pedido no es válido.", producto: "El producto no existe o no tiene precio.", precio: "Con ese descuento el precio no cambia.",
  guardar: "No se pudo guardar el precio. Intentá de nuevo.", sin_oferta: "Ese producto no tiene una oferta reciente para deshacer.",
};

async function Contenido({ searchParams }: { searchParams: PageProps<"/ofertas">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  const { supabase } = sesion;
  const q = await searchParams;

  const [vencRes, prodRes] = await Promise.all([
    supabase.rpc("vencimientos_proximos", { p_dias: VENTANA_OFERTAS_DIAS }),
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, precio_centavos").eq("activo", true),
  ]);
  const venc = vencRes.error ? null : leerVencimientos(vencRes.data);
  if (!venc || prodRes.error) return <Fallo texto="No pudimos cargar los vencimientos. Intentá de nuevo en un momento." />;

  const productos = prodRes.data.flatMap((p) => (p.id !== null && p.nombre !== null && p.tipo_venta !== null ? [{ id: p.id, nombre: p.nombre, tipoVenta: p.tipo_venta, precio: p.precio_centavos }] : []));
  const ids = [...new Set(venc.map((v) => v.producto_id))];

  // Costo vigente y últimos precios de esos productos (para el margen y para «volver al precio de antes»).
  const [costosRes, preciosRes] = ids.length > 0
    ? await Promise.all([
        supabase.from("costos_producto").select("producto_id, costo_centavos, vigente_desde").in("producto_id", ids).order("vigente_desde", { ascending: false }).order("id", { ascending: false }),
        supabase.from("precios_producto").select("producto_id, precio_centavos, vigente_desde").in("producto_id", ids).order("vigente_desde", { ascending: false }).order("id", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (costosRes.error || preciosRes.error) return <Fallo texto="No pudimos cargar los costos. Intentá de nuevo en un momento." />;

  const costos = new Map<number, number>();
  for (const c of costosRes.data ?? []) if (!costos.has(c.producto_id)) costos.set(c.producto_id, c.costo_centavos);
  const historial = new Map<number, { precio: number; desde: string }[]>();
  for (const p of preciosRes.data ?? []) historial.set(p.producto_id, [...(historial.get(p.producto_id) ?? []), { precio: p.precio_centavos, desde: p.vigente_desde }]);

  const ofertas = armarOfertas(venc, productos, costos);
  const ahora = new Date().getTime();

  return (
    <div className="space-y-5">
      {q.ok === "oferta" && <p role="status" data-ok className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Precio de oferta puesto. Ya se cobra así en la caja. Cuando termine, tocá «Volver al precio de antes».</p>}
      {q.ok === "quitada" && <p role="status" data-ok className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Volvió el precio de antes.</p>}
      {typeof q.error === "string" && <Fallo texto={ERRORES[q.error] ?? "No se pudo completar la acción."} />}

      {ofertas.length === 0 ? (
        <p data-sin-ofertas className="rounded-2xl border border-dashed border-crema/20 px-6 py-12 text-center text-emerald-300">
          ✓ Nada vence en los próximos {VENTANA_OFERTAS_DIAS} días. No hace falta hacer ofertas.
        </p>
      ) : (
        <ul className="space-y-4">
          {ofertas.map((f) => (
            <TarjetaOferta key={f.productoId} f={f} precioAntesDeOferta={precioAnteriorDeOferta(historial.get(f.productoId) ?? [], ahora)} />
          ))}
        </ul>
      )}
      <p className="text-xs text-crema/50">El descuento sugerido sube cuanto menos tiempo queda. «Poner este precio» cambia el precio de venta de ese producto hasta que lo vuelvas a cambiar (el precio anterior queda en el historial). Si no tiene costo cargado, no se puede calcular el margen.</p>
    </div>
  );
}
