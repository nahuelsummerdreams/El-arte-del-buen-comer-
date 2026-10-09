"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeDeErrorAlRegistrarMerma, validarMerma, type ErroresMerma } from "@/lib/inventario";
import type { TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";

export type ValoresMerma = { productoId: string; cantidad: string; motivo: string; detalle: string; clave: string };

export type EstadoMerma = {
  /** Cambia en cada respuesta; el formulario lo usa de `key` (React 19 reinicia los campos al terminar). */
  intento: number;
  errores: ErroresMerma;
  mensaje: string | null;
  valores: ValoresMerma;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function registrarMermaAccion(estadoPrevio: EstadoMerma, formData: FormData): Promise<EstadoMerma> {
  const intento = estadoPrevio.intento + 1;
  const valores: ValoresMerma = {
    productoId: texto(formData.get("productoId")),
    cantidad: texto(formData.get("cantidad")),
    motivo: texto(formData.get("motivo")),
    detalle: texto(formData.get("detalle")),
    clave: texto(formData.get("clave")),
  };

  // Identidad y permiso DENTRO de la acción: una Server Action es una puerta pública.
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") {
    return { intento, errores: {}, mensaje: "Solo el dueño puede registrar pérdidas.", valores };
  }

  // El tipo del producto (peso/unidad) se busca en la base: decide cómo se lee la cantidad.
  let tipoVenta: TipoVenta | null = null;
  if (/^\d+$/.test(valores.productoId.trim())) {
    const { data } = await sesion.supabase
      .from("productos")
      .select("tipo_venta")
      .eq("id", Number(valores.productoId))
      .eq("activo", true)
      .maybeSingle();
    tipoVenta = data?.tipo_venta ?? null;
  }

  const resultado = validarMerma(valores, tipoVenta);
  if (!resultado.ok) return { intento, errores: resultado.errores, mensaje: null, valores };
  const v = resultado.valores;

  const { error } = await sesion.supabase.rpc("registrar_merma", {
    p_producto_id: v.productoId,
    p_cantidad: v.cantidad,
    p_motivo: v.motivo,
    p_clave: v.clave,
  });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorAlRegistrarMerma(error), valores };

  revalidatePath("/inventario/merma");
  revalidatePath("/productos");
  revalidatePath("/");
  redirect("/inventario/merma?ok=1");
}
