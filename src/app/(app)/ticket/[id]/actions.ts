"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorAlAnular, validarAnulacion } from "@/lib/venta";

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * Anula una venta (solo el dueño, y solo mientras la caja de esa venta siga abierta: lo exige la base).
 * El resultado vuelve en la URL (?ok=anulada o ?error=...) para mostrarlo sin estado en el cliente.
 */
export async function anularVentaAccion(formData: FormData): Promise<void> {
  const idCrudo = texto(formData.get("ventaId")).trim();
  if (!/^\d{1,12}$/.test(idCrudo)) redirect("/");
  const id = Number(idCrudo);

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect(`/ticket/${id}?error=${encodeURIComponent("Solo el dueño puede anular ventas.")}`);

  const v = validarAnulacion(texto(formData.get("motivo")), texto(formData.get("detalle")));
  if (!v.ok) redirect(`/ticket/${id}?error=${encodeURIComponent(v.error)}`);

  const { error } = await sesion.supabase.rpc("anular_venta", { p_venta_id: id, p_motivo: v.motivo });
  if (error) redirect(`/ticket/${id}?error=${encodeURIComponent(mensajeDeErrorAlAnular(error))}`);

  revalidatePath("/", "layout");
  redirect(`/ticket/${id}?ok=anulada`);
}
