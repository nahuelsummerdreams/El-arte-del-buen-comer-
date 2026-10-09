import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioProducto } from "./formulario-producto";

export default function PaginaNuevoProducto() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <Link href="/productos" className="text-sm text-crema/60 hover:text-crema">
        ← Productos
      </Link>
      <h1 className="mb-8 mt-3 text-3xl font-semibold tracking-tight">Nuevo producto</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </main>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  // Comodidad: al cajero ni siquiera le mostramos el formulario. La seguridad real está en la
  // Server Action y en las reglas de la base de datos (RLS).
  if (sesion.perfil.rol !== "dueno") redirect("/productos");

  const { data: categorias } = await sesion.supabase
    .from("categorias")
    .select("id, nombre")
    .eq("activo", true)
    .order("id");

  return <FormularioProducto categorias={categorias ?? []} />;
}
