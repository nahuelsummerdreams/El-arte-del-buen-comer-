"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeDeErrorAlRegistrarIngreso, validarIngreso, type ErroresIngreso } from "@/lib/inventario";
import type { TipoVenta } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";

export type ValoresIngreso = {
  productoId: string;
  cantidad: string;
  nota: string;
  clave: string;
  costoTotal: string;
  vence: string;
  proveedorId: string;
  pagado: string;
  pagarHasta: string;
};

export type EstadoIngreso = {
  /** Cambia en cada respuesta; el formulario lo usa de `key` (React 19 reinicia los campos al terminar). */
  intento: number;
  errores: ErroresIngreso;
  mensaje: string | null;
  valores: ValoresIngreso;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function registrarIngresoAccion(
  estadoPrevio: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  const intento = estadoPrevio.intento + 1;
  const valores: ValoresIngreso = {
    productoId: texto(formData.get("productoId")),
    cantidad: texto(formData.get("cantidad")),
    nota: texto(formData.get("nota")),
    clave: texto(formData.get("clave")),
    costoTotal: texto(formData.get("costoTotal")),
    vence: texto(formData.get("vence")),
    proveedorId: texto(formData.get("proveedorId")),
    pagado: texto(formData.get("pagado")) || "si",
    pagarHasta: texto(formData.get("pagarHasta")),
  };

  // 1) Identidad y permiso, DENTRO de la acción (una Server Action es una puerta pública).
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") {
    return { intento, errores: {}, mensaje: "Solo el dueño puede registrar ingresos.", valores };
  }

  // 2) El tipo del producto (peso/unidad) se busca en la base: decide cómo se interpreta la cantidad
  //    y no se lo creemos al navegador.
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

  // 3) Validación en el servidor.
  const resultado = validarIngreso(valores, tipoVenta);
  if (!resultado.ok) return { intento, errores: resultado.errores, mensaje: null, valores };
  const v = resultado.valores;

  // 4) Todo en UNA operación de la base: suma el stock, guarda el lote (costo, vencimiento, proveedor,
  //    pago) y actualiza el costo del producto. La clave única hace que un doble envío no sume dos veces.
  const { error } = await sesion.supabase.rpc("registrar_ingreso", {
    p_producto_id: v.productoId,
    p_cantidad: v.cantidad,
    p_nota: v.nota,
    p_clave: v.clave,
    p_costo_total_centavos: v.costoTotalCentavos,
    p_vence_el: v.venceEl,
    p_proveedor_id: v.proveedorId,
    p_pagado: v.pagado,
    p_pagar_hasta: v.pagarHasta,
  });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorAlRegistrarIngreso(error), valores };

  revalidatePath("/productos");
  revalidatePath("/");
  redirect("/productos?ingreso=1");
}
