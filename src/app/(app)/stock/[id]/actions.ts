"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorDeStock, validarRecuento, type ErroresRecuento } from "@/lib/stock";

export type ValoresRecuento = { productoId: string; contado: string; motivo: string; detalle: string; clave: string };
export type EstadoRecuento = {
  /** Cambia en cada respuesta; el formulario lo usa de `key` (React 19 reinicia los campos al terminar). */
  intento: number;
  errores: ErroresRecuento;
  mensaje: string | null;
  valores: ValoresRecuento;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function registrarRecuentoAccion(previo: EstadoRecuento, formData: FormData): Promise<EstadoRecuento> {
  const intento = previo.intento + 1;
  const valores: ValoresRecuento = {
    productoId: texto(formData.get("productoId")),
    contado: texto(formData.get("contado")),
    motivo: texto(formData.get("motivo")),
    detalle: texto(formData.get("detalle")),
    clave: texto(formData.get("clave")),
  };

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") return { intento, errores: {}, mensaje: "Solo el dueño puede hacer recuentos.", valores };

  // El tipo (peso/unidad) se busca en la base: decide cómo se lee lo contado. No se le cree al navegador.
  let tipoVenta: TipoVenta | null = null;
  if (/^\d+$/.test(valores.productoId.trim())) {
    const { data } = await sesion.supabase.from("productos").select("tipo_venta").eq("id", Number(valores.productoId)).eq("activo", true).maybeSingle();
    tipoVenta = data?.tipo_venta ?? null;
  }

  const r = validarRecuento(valores, tipoVenta);
  if (!r.ok) return { intento, errores: r.errores, mensaje: null, valores };
  const v = r.valores;

  const { data: delta, error } = await sesion.supabase.rpc("registrar_ajuste", {
    p_producto_id: v.productoId,
    p_stock_contado: v.contado,
    p_motivo: v.motivo,
    p_clave: v.clave,
  });
  if (error || typeof delta !== "number") return { intento, errores: {}, mensaje: mensajeDeErrorDeStock(error ?? {}, "guardar el recuento"), valores };

  revalidatePath("/stock");
  revalidatePath(`/stock/${v.productoId}`);
  revalidatePath("/");
  redirect(`/stock/${v.productoId}?recuento=${delta}`);
}

/** Archivar no borra nada: el producto deja de ofrecerse y su historial queda completo. */
export async function archivarProductoAccion(formData: FormData): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/stock");

  const id = texto(formData.get("productoId"));
  if (!/^\d+$/.test(id)) redirect("/stock");
  const { error } = await sesion.supabase.rpc("archivar_producto", { p_id: Number(id), p_activo: false });
  if (error) redirect(`/stock/${id}?error=archivar`);

  revalidatePath("/stock");
  revalidatePath("/productos");
  revalidatePath("/venta");
  revalidatePath("/");
  redirect("/stock?ok=archivado");
}
