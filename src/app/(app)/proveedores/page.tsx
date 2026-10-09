import { redirect } from "next/navigation";
import { Suspense } from "react";
import { estadoDeuda, leerDeudas } from "@/lib/costos";
import { diaArgentina } from "@/lib/fechas";
import { formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { marcarPagadoAccion } from "./actions";
import { FormularioProveedor } from "./formulario-proveedor";

export default function PaginaProveedores(props: PageProps<"/proveedores">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Proveedores</h1>
      <p className="mb-8 text-sm text-crema/60">A quién le comprás y cuánto le debés. Lo que ingresás “a cuenta” aparece acá hasta que lo marques como pagado.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const colorEstado = { vencida: "bg-red-400/10 text-red-300", hoy: "bg-amber-400/10 text-amber-300", proxima: "bg-white/5 text-crema/70", sin_fecha: "bg-white/5 text-crema/60" } as const;
const iconoEstado = { vencida: "⚠", hoy: "●", proxima: "○", sin_fecha: "–" } as const;

async function Contenido({ searchParams }: { searchParams: PageProps<"/proveedores">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  const { supabase } = sesion;
  const q = await searchParams;
  const hoy = diaArgentina(new Date());

  const [proveedoresRes, deudasRes, productosRes] = await Promise.all([
    supabase.from("proveedores").select("id, nombre, telefono").eq("activo", true).order("nombre"),
    supabase.from("lotes_stock").select("id, producto_id, proveedor_id, costo_total_centavos, pagar_hasta").eq("pagado", false).order("pagar_hasta", { ascending: true, nullsFirst: false }),
    supabase.from("productos").select("id, nombre"),
  ]);
  const deudas = leerDeudas(deudasRes.data);
  if (proveedoresRes.error || deudasRes.error || productosRes.error || !deudas) {
    return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">No pudimos cargar los datos. Intentá de nuevo en un momento.</p>;
  }

  const producto = new Map(productosRes.data.map((p) => [p.id, p.nombre]));
  const proveedor = new Map(proveedoresRes.data.map((p) => [p.id, p.nombre]));
  const totalDeuda = deudas.reduce((s, d) => s + d.costo_total_centavos, 0);
  const deudaDe = (id: number) => deudas.filter((d) => d.proveedor_id === id).reduce((s, d) => s + d.costo_total_centavos, 0);

  return (
    <div className="space-y-8">
      {q.pagado === "1" && <p role="status" data-ok className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Marcado como pagado.</p>}
      {q.error === "pago" && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">No se pudo marcar como pagado. Intentá de nuevo.</p>}

      <section className="rounded-2xl border border-crema/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-medium">Cuentas a pagar</h2>
        {deudas.length === 0 ? (
          <p data-sin-deudas className="py-6 text-center text-sm text-emerald-300">✓ No le debés nada a nadie.</p>
        ) : (
          <>
            <p data-total-deuda className="mt-1 text-3xl font-semibold tabular-nums">{formatearPesos(totalDeuda)}</p>
            <p className="mb-2 text-sm text-crema/60">en {deudas.length} {deudas.length === 1 ? "compra pendiente" : "compras pendientes"}</p>
            <ul className="divide-y divide-crema/10">
              {deudas.map((d) => {
                const e = estadoDeuda(d.pagar_hasta, hoy);
                return (
                  <li key={d.id} data-deuda={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{producto.get(d.producto_id) ?? "Producto"}</span>
                      <span className="text-sm text-crema/55">{d.proveedor_id ? proveedor.get(d.proveedor_id) ?? "Proveedor" : "Sin proveedor"}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${colorEstado[e.estado]}`}><span aria-hidden>{iconoEstado[e.estado]}</span>{e.texto}</span>
                    <span className="tabular-nums">{formatearPesos(d.costo_total_centavos)}</span>
                    <form action={marcarPagadoAccion}>
                      <input type="hidden" name="loteId" value={d.id} />
                      <button type="submit" className="rounded-lg border border-crema/25 px-3 py-1.5 text-sm transition hover:bg-white/5">Marcar pagado</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-crema/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-lg font-medium">Tus proveedores</h2>
        {proveedoresRes.data.length === 0 ? (
          <p className="mb-4 text-sm text-crema/60">Todavía no cargaste ninguno. Agregá el primero para anotar a quién le comprás.</p>
        ) : (
          <ul className="mb-6 divide-y divide-crema/10">
            {proveedoresRes.data.map((p) => (
              <li key={p.id} data-proveedor={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span><span className="block font-medium">{p.nombre}</span>{p.telefono && <span className="text-sm text-crema/55">{p.telefono}</span>}</span>
                <span className="text-sm tabular-nums text-crema/70">{deudaDe(p.id) > 0 ? `Le debés ${formatearPesos(deudaDe(p.id))}` : "Sin deuda"}</span>
              </li>
            ))}
          </ul>
        )}
        <FormularioProveedor />
      </section>
    </div>
  );
}
