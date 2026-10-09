import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { centavosATextoEditable, type TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { Fallo } from "../../../_panel/vista-panel";
import { FormularioEdicion } from "./formulario-edicion";

export default function PaginaEditar(props: PageProps<"/productos/[id]/editar">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido params={props.params} />
      </Suspense>
    </main>
  );
}

async function Contenido({ params }: { params: PageProps<"/productos/[id]/editar">["params"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/productos");
  const { id: idCrudo } = await params;
  if (!/^\d+$/.test(idCrudo)) notFound();
  const id = Number(idCrudo);

  const [prod, cats] = await Promise.all([
    sesion.supabase.from("productos_con_precio").select("id, nombre, codigo, tipo_venta, categoria_id, stock_minimo, precio_centavos").eq("id", id).eq("activo", true).maybeSingle(),
    sesion.supabase.from("categorias").select("id, nombre").eq("activo", true).order("id"),
  ]);
  if (prod.error || cats.error) return <Fallo texto="No pudimos cargar el producto. Intentá de nuevo en un momento." />;
  const p = prod.data;
  if (!p || p.id === null || p.nombre === null || p.tipo_venta === null || p.categoria_id === null) notFound();

  const tipo: TipoVenta = p.tipo_venta;
  const minimo = p.stock_minimo ?? 0;
  // Mínimo en la unidad que se ve: kilos con coma (peso) o unidades.
  const minimoTexto = minimo === 0 ? "" : tipo === "peso" ? String(minimo / 1000).replace(".", ",") : String(minimo);

  return (
    <>
      <Link href={`/stock/${id}`} className="text-sm text-crema/60 hover:text-crema">← {p.nombre}</Link>
      <h1 className="mb-6 mt-3 font-display text-3xl tracking-tight">Editar producto</h1>
      <FormularioEdicion
        tipoVenta={tipo}
        categorias={cats.data}
        inicial={{
          productoId: String(id),
          nombre: p.nombre,
          categoriaId: String(p.categoria_id),
          codigo: p.codigo ?? "",
          stockMinimo: minimoTexto,
          precio: p.precio_centavos === null ? "" : centavosATextoEditable(p.precio_centavos),
        }}
      />
    </>
  );
}
