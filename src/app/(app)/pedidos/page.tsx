import { redirect } from "next/navigation";
import { Suspense } from "react";
import { diaArgentina } from "@/lib/fechas";
import { leerMasVendidos, restarDias } from "@/lib/panel";
import { cantidadSugerida, VENTANA_VENTAS_DIAS } from "@/lib/pedidos";
import { obtenerSesion } from "@/lib/sesion";
import { estadoDeStock } from "@/lib/stock";
import { Fallo } from "../_panel/vista-panel";
import { PantallaPedidos, type ItemPedido, type ProveedorPedido } from "./pantalla-pedidos";

export default function PaginaPedidos() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Pedidos a proveedor</h1>
      <p className="mb-6 mt-2 text-sm text-crema/60">Lo que hay que reponer, agrupado por proveedor y listo para mandar por WhatsApp.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </main>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  const { supabase } = sesion;
  const hoy = diaArgentina(new Date());

  const [prodRes, stockRes, vendRes, lotesRes, provRes, costosRes] = await Promise.all([
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, stock_minimo").eq("activo", true),
    supabase.from("stock_actual").select("producto_id, stock"),
    supabase.rpc("productos_mas_vendidos", { p_desde: restarDias(hoy, VENTANA_VENTAS_DIAS - 1), p_hasta: hoy, p_limite: 200 }),
    supabase.from("lotes_stock").select("producto_id, proveedor_id, creado_en").not("proveedor_id", "is", null).order("creado_en", { ascending: false }).order("id", { ascending: false }),
    supabase.from("proveedores").select("id, nombre, telefono").eq("activo", true).order("nombre"),
    supabase.from("costos_producto").select("producto_id, costo_centavos").order("vigente_desde", { ascending: false }).order("id", { ascending: false }),
  ]);
  const vendidos = leerMasVendidos(vendRes.data);
  if (prodRes.error || stockRes.error || vendRes.error || lotesRes.error || provRes.error || costosRes.error || !vendidos) {
    return <Fallo texto="No pudimos preparar el pedido. Intentá de nuevo en un momento." />;
  }

  const stockDe = new Map(stockRes.data.map((s) => [s.producto_id, s.stock ?? 0]));
  const vendidoDe = new Map(vendidos.map((v) => [v.producto_id, v.cantidad]));
  const proveedorDe = new Map<number, number>(); // el más reciente (las filas vienen de la más nueva a la más vieja)
  for (const l of lotesRes.data) if (l.proveedor_id !== null && !proveedorDe.has(l.producto_id)) proveedorDe.set(l.producto_id, l.proveedor_id);
  const costoDe = new Map<number, number>();
  for (const c of costosRes.data) if (!costoDe.has(c.producto_id)) costoDe.set(c.producto_id, c.costo_centavos);

  const items: ItemPedido[] = [];
  for (const p of prodRes.data) {
    if (p.id === null || p.nombre === null || p.tipo_venta === null) continue;
    const stock = stockDe.get(p.id) ?? 0;
    const minimo = p.stock_minimo ?? 0;
    if (estadoDeStock(stock, minimo) === "ok") continue;
    const s = cantidadSugerida({ stock, minimo, vendido: vendidoDe.get(p.id) ?? 0, tipoVenta: p.tipo_venta });
    items.push({ id: p.id, nombre: p.nombre, tipoVenta: p.tipo_venta, stock, proveedorId: proveedorDe.get(p.id) ?? null, costo: costoDe.get(p.id) ?? null, sugerida: s.cantidad, motivo: s.motivo, vendido: vendidoDe.get(p.id) ?? 0 });
  }
  items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const proveedores: ProveedorPedido[] = provRes.data.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono }));

  return <PantallaPedidos items={items} proveedores={proveedores} />;
}
