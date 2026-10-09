import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { leerAjustesDelPeriodo, leerValorInventario } from "@/lib/stock";
import { diaArgentina } from "@/lib/fechas";
import { restarDias } from "@/lib/panel";
import { formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { contarPorEstado, type ItemStock } from "@/lib/stock";
import { TarjetaIndicador } from "../_panel/tarjeta-indicador";
import { Fallo } from "../_panel/vista-panel";
import { PantallaStock } from "./pantalla-stock";

export default function PaginaStock(props: PageProps<"/stock">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Stock</h1>
      <p className="mb-6 mt-2 text-sm text-crema/60">Lo que hay de cada producto, lo más urgente primero.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/stock">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase, perfil } = sesion;
  const esDueno = perfil.rol === "dueno";
  const q = await searchParams;
  const hoy = diaArgentina(new Date());

  const [productos, categorias, stocks, valorRes, ajustesRes] = await Promise.all([
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, categoria_id, stock_minimo").eq("activo", true),
    supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
    supabase.from("stock_actual").select("producto_id, stock"),
    esDueno ? supabase.rpc("valor_inventario") : Promise.resolve({ data: null, error: null }),
    esDueno ? supabase.rpc("ajustes_del_periodo", { p_desde: restarDias(hoy, 29), p_hasta: hoy }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (productos.error || categorias.error || stocks.error) return <Fallo texto="No pudimos cargar el stock. Intentá de nuevo en un momento." />;

  const stockDe = new Map(stocks.data.map((s) => [s.producto_id, s.stock ?? 0]));
  const items: ItemStock[] = productos.data.flatMap((p) =>
    p.id !== null && p.nombre !== null && p.tipo_venta !== null && p.categoria_id !== null
      ? [{ id: p.id, nombre: p.nombre, categoriaId: p.categoria_id, tipoVenta: p.tipo_venta, stock: stockDe.get(p.id) ?? 0, stockMinimo: p.stock_minimo ?? 0 }]
      : [],
  );
  const conteo = contarPorEstado(items);
  const valor = esDueno && !valorRes.error ? leerValorInventario(valorRes.data) : null;
  const ajustes = esDueno && !ajustesRes.error ? leerAjustesDelPeriodo(ajustesRes.data) : null;

  return (
    <div className="space-y-6">
      {q.ok === "recuento" && <p role="status" data-ok className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Recuento guardado.</p>}
      {q.ok === "archivado" && <p role="status" data-ok className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Producto archivado. Ya no aparece para vender; su historial se conserva.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaIndicador indice={0} icono="productos" etiqueta="Productos" valor={String(items.length)} detalle="activos" />
        <TarjetaIndicador
          indice={1}
          icono="alerta"
          etiqueta="Para revisar"
          valor={String(conteo.negativo + conteo.sin_stock + conteo.bajo)}
          detalle={conteo.negativo > 0 ? `${conteo.negativo} en negativo` : conteo.sin_stock > 0 ? `${conteo.sin_stock} sin stock` : "todo en orden"}
          acento={conteo.negativo + conteo.sin_stock + conteo.bajo > 0 ? "atencion" : undefined}
        />
        {esDueno && (
          <>
            <TarjetaIndicador
              indice={2}
              icono="ganancia"
              etiqueta="Valor del inventario"
              valor={valor ? formatearPesos(valor.valor_centavos) : "—"}
              detalle={valor ? (valor.sin_costo > 0 ? `${valor.sin_costo} con stock sin costo cargado` : "al último costo cargado") : "no disponible"}
            />
            <TarjetaIndicador
              indice={3}
              icono="papelera"
              etiqueta="Faltante por recuentos"
              valor={ajustes ? formatearPesos(ajustes.faltante_centavos) : "—"}
              detalle={ajustes ? (ajustes.ajustes === 0 ? "sin recuentos en 30 días" : `en ${ajustes.ajustes} ${ajustes.ajustes === 1 ? "ajuste" : "ajustes"} · 30 días`) : "no disponible"}
            />
          </>
        )}
      </div>

      {conteo.negativo > 0 && (
        <p role="note" data-aviso-negativo className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Hay {conteo.negativo} {conteo.negativo === 1 ? "producto con stock negativo" : "productos con stock negativo"}: se vendió más de lo que el sistema creía que había.
          {esDueno ? " Contá lo que hay y corregilo con «Recuento»." : " Avisale al dueño."}
        </p>
      )}

      <PantallaStock items={items} categorias={categorias.data} puedeEditar={esDueno} />

      {esDueno && (
        <p className="text-sm text-crema/55">
          Tocá un producto para ver su historial, contarlo, editarlo o archivarlo. Para sumar mercadería: <Link href="/inventario/ingreso" className="underline underline-offset-4">Ingresar mercadería</Link>.
        </p>
      )}
    </div>
  );
}
