"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorDeVenta, validarEnvioVenta } from "@/lib/venta";

export type EstadoVenta = {
  /** Cambia en cada respuesta, para que la pantalla pueda reaccionar. */
  intento: number;
  mensaje: string | null;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function registrarVentaAccion(previo: EstadoVenta, formData: FormData): Promise<EstadoVenta> {
  const intento = previo.intento + 1;

  // 1) Quién es (dentro de la acción: es una puerta pública).
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  // 2) Validación de lo que mandó el navegador. De cada renglón solo se conservan producto y cantidad.
  const envio = validarEnvioVenta({
    items: texto(formData.get("items")),
    medio: texto(formData.get("medio")),
    total: texto(formData.get("total")),
    descuento: texto(formData.get("descuento")),
    clave: texto(formData.get("clave")),
  });
  if (!envio.ok) return { intento, mensaje: envio.mensaje };
  const v = envio.valores;

  // 3) Una sola llamada a la base: ella busca los precios, calcula el total, verifica que el pago lo
  //    cubra EXACTAMENTE, guarda la venta y descuenta el stock, todo en una transacción.
  const { data, error } = await sesion.supabase.rpc("registrar_venta", {
    p_items: v.items,
    p_pagos: v.pagos,
    p_descuento_centavos: v.descuento,
    p_clave: v.clave,
  });
  if (error) return { intento, mensaje: mensajeDeErrorDeVenta(error) };
  if (typeof data !== "number") return { intento, mensaje: "No pudimos confirmar la venta. Revisá el historial antes de cobrar de nuevo." };

  revalidatePath("/venta");
  revalidatePath("/productos");
  revalidatePath("/caja");
  redirect(`/venta?ok=${data}`);
}
