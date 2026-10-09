"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorDeStock, validarEdicionProducto, type ErroresEdicion } from "@/lib/stock";

export type ValoresEdicion = { productoId: string; nombre: string; categoriaId: string; codigo: string; stockMinimo: string; precio: string };
export type EstadoEdicion = { intento: number; errores: ErroresEdicion; mensaje: string | null; valores: ValoresEdicion };

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function editarProductoAccion(previo: EstadoEdicion, formData: FormData): Promise<EstadoEdicion> {
  const intento = previo.intento + 1;
  const valores: ValoresEdicion = {
    productoId: texto(formData.get("productoId")),
    nombre: texto(formData.get("nombre")),
    categoriaId: texto(formData.get("categoriaId")),
    codigo: texto(formData.get("codigo")),
    stockMinimo: texto(formData.get("stockMinimo")),
    precio: texto(formData.get("precio")),
  };

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") return { intento, errores: {}, mensaje: "Solo el dueño puede editar productos.", valores };

  // El tipo de venta se lee de la base y NO se puede cambiar: todo el historial está en gramos o en unidades.
  let tipoVenta: TipoVenta | null = null;
  if (/^\d+$/.test(valores.productoId.trim())) {
    const { data } = await sesion.supabase.from("productos").select("tipo_venta").eq("id", Number(valores.productoId)).eq("activo", true).maybeSingle();
    tipoVenta = data?.tipo_venta ?? null;
  }

  const r = validarEdicionProducto(valores, tipoVenta);
  if (!r.ok) return { intento, errores: r.errores, mensaje: null, valores };
  const v = r.valores;

  const { error } = await sesion.supabase.rpc("actualizar_producto", {
    p_id: Number(valores.productoId),
    p_nombre: v.nombre,
    p_categoria_id: v.categoriaId,
    p_codigo: v.codigo,
    p_stock_minimo: v.stockMinimo,
    p_precio_centavos: v.precioCentavos,
  });
  if (error) {
    const repetido = error.code === "23505";
    return {
      intento,
      errores: repetido && (error.message ?? "").includes("productos_nombre_por_categoria_unico") ? { nombre: mensajeDeErrorDeStock(error, "guardar") } : {},
      mensaje: repetido && (error.message ?? "").includes("productos_nombre_por_categoria_unico") ? null : mensajeDeErrorDeStock(error, "guardar los cambios"),
      valores,
    };
  }

  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/venta");
  revalidatePath("/");
  redirect(`/stock/${valores.productoId}?ok=editado`);
}
