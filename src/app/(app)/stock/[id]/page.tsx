import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { formatearFechaHora } from "@/lib/fechas";
import { formatearCantidad, formatearPesos, formatearStock, type TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { estadoDeStock, ETIQUETA_ESTADO, ETIQUETA_MOVIMIENTO, leerHistorial } from "@/lib/stock";
import { Fallo, Seccion } from "../../_panel/vista-panel";
import { archivarProductoAccion } from "./actions";
import { FormularioRecuento } from "./formulario-recuento";

export default function PaginaProductoStock(props: PageProps<"/stock/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/stock" className="text-sm text-crema/60 hover:text-crema">← Stock</Link>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ params, searchParams }: { params: PageProps<"/stock/[id]">["params"]; searchParams: PageProps<"/stock/[id]">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/stock");
  const { supabase } = sesion;
  const { id: idCrudo } = await params;
  if (!/^\d+$/.test(idCrudo)) notFound();
  const id = Number(idCrudo);
  const q = await searchParams;

  const [prodRes, stockRes, histRes, catRes] = await Promise.all([
    supabase.from("productos_con_precio").select("id, nombre, codigo, tipo_venta, categoria_id, stock_minimo, precio_centavos").eq("id", id).eq("activo", true).maybeSingle(),
    supabase.from("stock_actual").select("stock").eq("producto_id", id).maybeSingle(),
    supabase.rpc("historial_producto", { p_producto_id: id, p_limite: 30 }),
    supabase.from("categorias").select("id, nombre"),
  ]);
  if (prodRes.error || stockRes.error || catRes.error) return <Fallo texto="No pudimos cargar el producto. Intentá de nuevo en un momento." />;
  const p = prodRes.data;
  if (!p || p.id === null || p.nombre === null || p.tipo_venta === null || p.categoria_id === null) notFound();

  const tipo: TipoVenta = p.tipo_venta;
  const nombre: string = p.nombre;
  const stock = stockRes.data?.stock ?? 0;
  const minimo = p.stock_minimo ?? 0;
  const estado = estadoDeStock(stock, minimo);
  const historial = histRes.error ? null : leerHistorial(histRes.data);
  const categoria = catRes.data.find((c) => c.id === p.categoria_id)?.nombre ?? "Sin categoría";

  const recuento = typeof q.recuento === "string" && /^-?\d{1,10}$/.test(q.recuento) ? Number(q.recuento) : null;

  return (
    <div className="space-y-6">
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{nombre}</h1>
          <p className="mt-1 text-sm text-crema/60">
            {categoria} · {tipo === "peso" ? "Por peso" : "Por unidad"}
            {p.codigo ? ` · ${p.codigo}` : ""}
            {p.precio_centavos !== null ? ` · ${formatearPesos(p.precio_centavos)} ${tipo === "peso" ? "el kilo" : "cada una"}` : ""}
          </p>
        </div>
        <Link href={`/productos/${id}/editar`} className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5">Editar producto</Link>
      </header>

      {q.ok === "editado" && <p role="status" data-ok className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Producto actualizado.</p>}
      {q.error === "archivar" && <Fallo texto="No se pudo archivar el producto. Intentá de nuevo." />}
      {recuento !== null && (
        <p role="status" data-ok data-recuento-guardado className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          ✓ Recuento guardado. {recuento === 0 ? "El stock ya coincidía con lo contado." : `Se ${recuento < 0 ? "restaron" : "sumaron"} ${formatearCantidad(Math.abs(recuento), tipo)} para que coincida.`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="fx-entra rounded-2xl border border-crema/10 bg-white/[0.04] p-5">
          <p className="text-sm text-crema/60">Stock actual</p>
          <p data-stock-actual className="mt-1 text-3xl font-semibold tabular-nums">{formatearStock(stock, tipo)}</p>
          <p className={`mt-1 text-sm ${estado === "ok" ? "text-emerald-300" : estado === "bajo" ? "text-amber-300" : "text-red-300"}`}>{ETIQUETA_ESTADO[estado]}</p>
        </div>
        <div className="fx-entra rounded-2xl border border-crema/10 bg-white/[0.04] p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="text-sm text-crema/60">Stock mínimo</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{minimo > 0 ? formatearStock(minimo, tipo) : "—"}</p>
          <p className="mt-1 text-sm text-crema/55">{minimo > 0 ? "Avisa cuando llega acá" : "Sin mínimo cargado"}</p>
        </div>
        <div className="fx-entra rounded-2xl border border-crema/10 bg-white/[0.04] p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-sm text-crema/60">Reponer</p>
          <Link href="/inventario/ingreso" className="mt-2 inline-block text-sm underline underline-offset-4">Ingresar mercadería</Link>
          <br />
          <Link href="/inventario/merma" className="mt-1 inline-block text-sm underline underline-offset-4">Registrar una pérdida</Link>
        </div>
      </div>

      <Seccion titulo="Recuento" subtitulo="Contá lo que hay y dejá el sistema igual a la realidad." indice={3}>
        <FormularioRecuento productoId={id} tipoVenta={tipo} stockActual={stock} claveInicial={crypto.randomUUID()} />
      </Seccion>

      <Seccion titulo="Historial" subtitulo="Cada movimiento, del más nuevo al más viejo, con cómo quedó el stock." indice={4}>
        {historial === null ? (
          <Fallo texto="No pudimos cargar el historial." />
        ) : historial.length === 0 ? (
          <p className="py-6 text-center text-sm text-crema/60">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-crema/10" data-historial>
            {historial.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{ETIQUETA_MOVIMIENTO[h.tipo]}</span>
                  <span className="block text-xs text-crema/55">{formatearFechaHora(h.creado_en)} · {h.usuario}{h.motivo ? ` · ${h.motivo}` : ""}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-sm font-semibold tabular-nums ${h.cantidad < 0 ? "text-amber-300" : "text-emerald-300"}`}>
                    {h.cantidad < 0 ? "−" : "+"}{formatearCantidad(Math.abs(h.cantidad), tipo)}
                  </span>
                  <span className="block text-xs text-crema/55">quedó en {formatearStock(h.saldo, tipo)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Archivar producto" subtitulo="Para lo que ya no vendés. No se borra nada: deja de aparecer para vender y su historial se conserva (su código, si tiene, queda reservado)." indice={5}>
        <details className="group">
          <summary className="inline-block cursor-pointer rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300 transition hover:bg-red-400/10">Archivar este producto…</summary>
          <form action={archivarProductoAccion} className="mt-4 space-y-3">
            <input type="hidden" name="productoId" value={id} />
            <p className="text-sm text-crema/75">
              {stock !== 0 ? `Todavía figura con ${formatearStock(stock, tipo)} de stock. ` : ""}
              ¿Seguro que querés archivar <strong>{nombre}</strong>?
            </p>
            <button type="submit" className="rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500">Sí, archivar</button>
          </form>
        </details>
      </Seccion>
    </div>
  );
}
