import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatearStock } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioIngreso, type ProductoParaIngreso } from "./formulario-ingreso";

export default function PaginaIngreso() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <Link href="/productos" className="text-sm text-crema/60 hover:text-crema">
        ← Productos
      </Link>
      <h1 className="mb-2 mt-3 text-3xl font-semibold tracking-tight">Ingresar mercadería</h1>
      <p className="mb-8 text-sm text-crema/60">Sumá al stock lo que acaba de llegar.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </main>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  // Comodidad: al cajero no le mostramos el formulario. La seguridad real está en la Server Action
  // y en las reglas de la base (RLS).
  if (sesion.perfil.rol !== "dueno") redirect("/productos");
  const { supabase } = sesion;

  const [productos, categorias, stocks] = await Promise.all([
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, categoria_id").eq("activo", true),
    supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
    supabase.from("stock_actual").select("producto_id, stock"),
  ]);

  if (productos.error || categorias.error || stocks.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">
        No pudimos cargar los productos. Intentá de nuevo en un momento.
      </p>
    );
  }

  const stockDe = new Map(stocks.data.map((s) => [s.producto_id, s.stock]));
  const lista: ProductoParaIngreso[] = productos.data
    .flatMap((p) =>
      p.id !== null && p.nombre !== null && p.tipo_venta !== null && p.categoria_id !== null
        ? [
            {
              id: p.id,
              nombre: p.nombre,
              tipoVenta: p.tipo_venta,
              categoriaId: p.categoria_id,
              stockTexto: formatearStock(stockDe.get(p.id) ?? 0, p.tipo_venta),
            },
          ]
        : [],
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  if (lista.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-crema/20 px-6 py-12 text-center">
        <p className="text-lg">Primero cargá al menos un producto.</p>
        <Link href="/productos/nuevo" className="mt-4 inline-block text-sm underline underline-offset-4">
          Crear un producto
        </Link>
      </div>
    );
  }

  // Un código único por cada vez que se abre el formulario (ver idempotencia en el formulario).
  // Se genera acá, ya en el servidor y después de leer la sesión, para que cliente y servidor
  // vean EL MISMO valor (generarlo en el navegador desajustaría la hidratación).
  const claveInicial = crypto.randomUUID();

  return <FormularioIngreso productos={lista} categorias={categorias.data} claveInicial={claveInicial} />;
}
