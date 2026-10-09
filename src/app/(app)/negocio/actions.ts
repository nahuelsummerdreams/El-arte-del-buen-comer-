"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { diaArgentina } from "@/lib/fechas";
import { primerDiaDelMes, validarMonto, validarNombre } from "@/lib/metas";
import { obtenerSesion } from "@/lib/sesion";

export type EstadoSimple = { intento: number; errores: Record<string, string>; mensaje: string | null; valores: Record<string, string> };

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function sesionDueno() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion.perfil.rol === "dueno" ? sesion : null;
}

export async function guardarMetaAccion(previo: EstadoSimple, formData: FormData): Promise<EstadoSimple> {
  const intento = previo.intento + 1;
  const valores = { meta: texto(formData.get("meta")) };
  const sesion = await sesionDueno();
  if (!sesion) return { intento, errores: {}, mensaje: "Solo el dueño puede definir la meta.", valores };

  const m = validarMonto(valores.meta);
  if (!m.ok) return { intento, errores: { meta: m.error }, mensaje: null, valores };

  // Una meta por mes: si ya existe, se reemplaza. El mes sale de la hora de Argentina, no del servidor.
  const { error } = await sesion.supabase
    .from("metas_mensuales")
    .upsert({ mes: primerDiaDelMes(diaArgentina(new Date())), meta_centavos: m.centavos, actualizado_en: new Date().toISOString() });
  if (error) return { intento, errores: {}, mensaje: "No se pudo guardar la meta. Intentá de nuevo.", valores };

  revalidatePath("/negocio");
  revalidatePath("/");
  return { intento, errores: {}, mensaje: null, valores: { meta: "" } };
}

export async function agregarGastoAccion(previo: EstadoSimple, formData: FormData): Promise<EstadoSimple> {
  const intento = previo.intento + 1;
  const valores = { nombre: texto(formData.get("nombre")), monto: texto(formData.get("monto")) };
  const sesion = await sesionDueno();
  if (!sesion) return { intento, errores: {}, mensaje: "Solo el dueño puede cargar gastos.", valores };

  const nombre = validarNombre(valores.nombre, "el nombre del gasto");
  const monto = validarMonto(valores.monto, { permitirCero: false });
  if (!nombre.ok || !monto.ok) {
    return { intento, errores: { ...(nombre.ok ? {} : { nombre: nombre.error }), ...(monto.ok ? {} : { monto: monto.error }) }, mensaje: null, valores };
  }

  const { error } = await sesion.supabase.from("gastos_fijos").insert({ nombre: nombre.nombre, monto_centavos: monto.centavos });
  if (error) return { intento, errores: {}, mensaje: "No se pudo guardar el gasto. Intentá de nuevo.", valores };

  revalidatePath("/negocio");
  return { intento, errores: {}, mensaje: null, valores: { nombre: "", monto: "" } };
}

/** Los gastos no se borran: se archivan (dejan de contar, el registro queda). */
export async function quitarGastoAccion(formData: FormData): Promise<void> {
  const sesion = await sesionDueno();
  if (!sesion) redirect("/");
  const id = texto(formData.get("gastoId"));
  if (!/^\d+$/.test(id)) redirect("/negocio");
  await sesion.supabase.from("gastos_fijos").update({ activo: false }).eq("id", Number(id));
  revalidatePath("/negocio");
  redirect("/negocio");
}
