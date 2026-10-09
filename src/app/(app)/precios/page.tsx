import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioPrecios } from "./formulario-precios";

export default function PaginaPrecios(props: PageProps<"/precios">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Actualizar precios</h1>
      <p className="mb-8 text-sm text-crema/60">Subí (o bajá) todos los precios de golpe, con vista previa antes de confirmar.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/precios">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  const q = await searchParams;

  const [productos, categorias] = await Promise.all([
    sesion.supabase.from("productos_con_precio").select("id, nombre, categoria_id, precio_centavos").eq("activo", true),
    sesion.supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
  ]);
  if (productos.error || categorias.error) {
    return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">No pudimos cargar los precios. Intentá de nuevo en un momento.</p>;
  }

  const lista = productos.data.flatMap((p) =>
    p.id !== null && p.nombre !== null && p.categoria_id !== null && p.precio_centavos !== null
      ? [{ id: p.id, nombre: p.nombre, categoriaId: p.categoria_id, precio: p.precio_centavos }]
      : [],
  );
  const listo = typeof q.listo === "string" && /^\d+$/.test(q.listo) ? Number(q.listo) : null;

  return (
    <div className="space-y-6">
      {listo !== null && <p role="status" data-ok className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">✓ Listo: se actualizaron {listo} {listo === 1 ? "precio" : "precios"}.</p>}
      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-crema/20 px-6 py-12 text-center">Todavía no hay productos con precio.</p>
      ) : (
        <FormularioPrecios productos={lista} categorias={categorias.data} />
      )}
    </div>
  );
}
