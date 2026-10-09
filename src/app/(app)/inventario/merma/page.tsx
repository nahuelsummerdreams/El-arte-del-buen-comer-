import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { leerMermas } from "@/lib/costos";
import { formatearFechaHora, diaArgentina } from "@/lib/fechas";
import { restarDias } from "@/lib/panel";
import { formatearCantidad, formatearPesos, formatearStock } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioMerma, type ProductoParaMerma } from "./formulario-merma";

export default function PaginaMerma(props: PageProps<"/inventario/merma">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/productos" className="text-sm text-crema/60 hover:text-crema">← Productos</Link>
      <h1 className="mb-2 mt-3 text-3xl font-semibold tracking-tight">Registrar pérdida</h1>
      <p className="mb-8 text-sm text-crema/60">Lo que se vence, se echa a perder o se pierde. Anotarlo te muestra cuánto plata se va y por qué.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/inventario/merma">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/productos");
  const { supabase } = sesion;
  const q = await searchParams;

  const hoy = diaArgentina(new Date());
  const [productos, categorias, stocks, recientes, resumen] = await Promise.all([
    supabase.from("productos").select("id, nombre, tipo_venta, categoria_id").eq("activo", true),
    supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
    supabase.from("stock_actual").select("producto_id, stock"),
    supabase.from("movimientos_stock").select("producto_id, cantidad, motivo, creado_en").eq("tipo", "merma").order("creado_en", { ascending: false }).limit(8),
    supabase.rpc("mermas_del_periodo", { p_desde: restarDias(hoy, 29), p_hasta: hoy }),
  ]);

  const mermas = leerMermas(resumen.data);
  if (productos.error || categorias.error || stocks.error || recientes.error || resumen.error || !mermas) {
    return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">No pudimos cargar los datos. Intentá de nuevo en un momento.</p>;
  }

  const stockDe = new Map(stocks.data.map((s) => [s.producto_id, s.stock]));
  const porId = new Map(productos.data.map((p) => [p.id, p]));
  const lista: ProductoParaMerma[] = productos.data
    .map((p) => ({ id: p.id, nombre: p.nombre, tipoVenta: p.tipo_venta, categoriaId: p.categoria_id, stockTexto: formatearStock(stockDe.get(p.id) ?? 0, p.tipo_venta) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const perdido = mermas.reduce((s, m) => s + m.costo_centavos, 0);
  const sinCosto = mermas.reduce((s, m) => s + m.sin_costo, 0);

  return (
    <div className="space-y-8">
      {q.ok === "1" && (
        <p role="status" data-ok className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          ✓ Pérdida registrada. El stock ya se descontó.
        </p>
      )}

      <section aria-label="Resumen de pérdidas" className="rounded-2xl border border-crema/10 bg-white/[0.04] p-5">
        <p className="text-sm text-crema/60">Últimos 30 días</p>
        {mermas.length === 0 ? (
          <p className="mt-1 text-lg">Sin pérdidas registradas.</p>
        ) : (
          <>
            <p data-perdido className="mt-1 text-3xl font-semibold tabular-nums">{formatearPesos(perdido)}</p>
            <p className="text-sm text-crema/60">
              en mercadería perdida ({mermas.length} {mermas.length === 1 ? "producto" : "productos"})
              {sinCosto > 0 && ` · ${sinCosto} ${sinCosto === 1 ? "registro" : "registros"} sin costo cargado, no suman acá`}
            </p>
            <ul className="mt-4 divide-y divide-crema/10 text-sm">
              {mermas.slice(0, 5).map((m) => (
                <li key={m.producto_id} className="flex justify-between gap-3 py-2">
                  <span>{m.nombre} <span className="text-crema/50">· {formatearCantidad(m.cantidad, m.tipo_venta)}</span></span>
                  <span className="tabular-nums">{formatearPesos(m.costo_centavos)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <FormularioMerma productos={lista} categorias={categorias.data} claveInicial={crypto.randomUUID()} />

      {recientes.data.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Últimos registros</h2>
          <ul className="divide-y divide-crema/10 rounded-2xl border border-crema/10 bg-white/[0.04] px-4 text-sm">
            {recientes.data.map((r, i) => {
              const p = porId.get(r.producto_id);
              return (
                <li key={i} className="py-3">
                  <p className="font-medium">{p?.nombre ?? "Producto"} <span className="font-normal text-crema/60">· {p ? formatearCantidad(-r.cantidad, p.tipo_venta) : ""}</span></p>
                  <p className="text-crema/55">{r.motivo} · {formatearFechaHora(r.creado_en)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
