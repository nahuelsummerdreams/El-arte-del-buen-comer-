import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatearPesos, formatearStock } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";

export default function PaginaProductos(props: PageProps<"/productos">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-crema/60 hover:text-crema">
        ← Panel
      </Link>
      {/* Todo lo que depende de la sesión va dentro de <Suspense> (Cache Components). */}
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/productos">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase, perfil } = sesion;
  const { creado, ingreso } = await searchParams;

  // Tres consultas en paralelo (no una después de otra).
  const [productos, categorias, stocks] = await Promise.all([
    supabase
      .from("productos_con_precio")
      .select("id, nombre, codigo, tipo_venta, categoria_id, precio_centavos")
      .eq("activo", true),
    supabase.from("categorias").select("id, nombre"),
    supabase.from("stock_actual").select("producto_id, stock"),
  ]);

  if (productos.error || categorias.error || stocks.error) {
    return (
      <p role="alert" className="mt-8 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">
        No pudimos cargar los productos. Intentá de nuevo en un momento.
      </p>
    );
  }

  const nombreCategoria = new Map(categorias.data.map((c) => [c.id, c.nombre]));
  const stockDe = new Map(stocks.data.map((s) => [s.producto_id, s.stock]));

  // Las vistas de la base marcan todo como "puede ser null"; descartamos filas incompletas.
  const filas = productos.data
    .flatMap((p) =>
      p.id !== null && p.nombre !== null && p.tipo_venta !== null && p.categoria_id !== null
        ? [{ ...p, id: p.id, nombre: p.nombre, tipo_venta: p.tipo_venta, categoria_id: p.categoria_id }]
        : [],
    )
    .sort(
      (a, b) =>
        (nombreCategoria.get(a.categoria_id) ?? "").localeCompare(nombreCategoria.get(b.categoria_id) ?? "", "es") ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  return (
    <>
      <div className="mb-6 mt-3 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
        {perfil.rol === "dueno" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/inventario/ingreso"
              className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              Ingresar mercadería
            </Link>
            <Link
              href="/stock"
              className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              Stock
            </Link>
            <Link
              href="/productos/nuevo"
              className="rounded-lg bg-crema px-4 py-2 text-sm font-medium text-tinta transition hover:bg-crema/90"
            >
              + Nuevo producto
            </Link>
          </div>
        )}
      </div>

      {creado === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          Producto creado correctamente.
        </p>
      )}

      {ingreso === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          Ingreso de mercadería registrado.
        </p>
      )}

      {filas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-crema/20 px-6 py-14 text-center">
          <p className="text-lg">Todavía no hay productos cargados.</p>
          <p className="mt-1 text-sm text-crema/60">
            {perfil.rol === "dueno"
              ? "Empezá con «+ Nuevo producto»: nombre, categoría, cómo se vende y su precio."
              : "El dueño todavía no cargó el catálogo."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-crema/10 rounded-lg border border-crema/15">
          {filas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nombre}</p>
                <p className="truncate text-sm text-crema/60">
                  {nombreCategoria.get(p.categoria_id) ?? "Sin categoría"} ·{" "}
                  {p.tipo_venta === "peso" ? "Por peso" : "Por unidad"}
                  {p.codigo ? ` · ${p.codigo}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">
                  {p.precio_centavos === null ? (
                    "Sin precio"
                  ) : (
                    <>
                      {formatearPesos(p.precio_centavos)}
                      <span className="text-sm text-crema/60"> {p.tipo_venta === "peso" ? "/kg" : "/u."}</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-crema/60">Stock: {formatearStock(stockDe.get(p.id) ?? 0, p.tipo_venta)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
