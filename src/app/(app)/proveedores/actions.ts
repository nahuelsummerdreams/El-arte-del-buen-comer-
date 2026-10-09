"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarNombre, validarTelefono } from "@/lib/metas";
import { obtenerSesion } from "@/lib/sesion";

export type EstadoProveedor = {
  intento: number;
  errores: { nombre?: string; telefono?: string };
  mensaje: string | null;
  valores: { nombre: string; telefono: string };
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function crearProveedorAccion(previo: EstadoProveedor, formData: FormData): Promise<EstadoProveedor> {
  const intento = previo.intento + 1;
  const valores = { nombre: texto(formData.get("nombre")), telefono: texto(formData.get("telefono")) };

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") return { intento, errores: {}, mensaje: "Solo el dueño puede agregar proveedores.", valores };

  const nombre = validarNombre(valores.nombre, "el nombre del proveedor");
  const telefono = validarTelefono(valores.telefono);
  if (!nombre.ok || !telefono.ok) {
    return { intento, errores: { nombre: nombre.ok ? undefined : nombre.error, telefono: telefono.ok ? undefined : telefono.error }, mensaje: null, valores };
  }

  const { error } = await sesion.supabase.from("proveedores").insert({ nombre: nombre.nombre, telefono: telefono.telefono });
  if (error) {
    const repetido = error.code === "23505";
    return { intento, errores: repetido ? { nombre: "Ya tenés un proveedor con ese nombre." } : {}, mensaje: repetido ? null : "No se pudo guardar el proveedor. Intentá de nuevo.", valores };
  }

  revalidatePath("/proveedores");
  return { intento, errores: {}, mensaje: null, valores: { nombre: "", telefono: "" } };
}

/** Marca una deuda como pagada. Solo el dueño; solo si todavía estaba pendiente (pagar dos veces no hace nada). */
export async function marcarPagadoAccion(formData: FormData): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");

  const id = texto(formData.get("loteId"));
  if (!/^\d+$/.test(id)) redirect("/proveedores?error=pago");

  const { error } = await sesion.supabase
    .from("lotes_stock")
    .update({ pagado: true, pagado_en: new Date().toISOString() })
    .eq("id", Number(id))
    .eq("pagado", false);
  if (error) redirect("/proveedores?error=pago");

  revalidatePath("/proveedores");
  revalidatePath("/");
  redirect("/proveedores?pagado=1");
}
