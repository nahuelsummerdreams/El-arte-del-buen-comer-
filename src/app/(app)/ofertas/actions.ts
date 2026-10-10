"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esDescuentoValido, precioAnteriorDeOferta, precioConOferta } from "@/lib/ofertas";
import { obtenerSesion } from "@/lib/sesion";

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function dueno() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  return sesion;
}

/**
 * Pone el precio de oferta. El navegador manda SOLO qué producto y qué descuento (de una lista fija):
 * el precio de hoy se lee de la base y la cuenta se hace acá. Si se repite el envío, no pasa nada
 * (la base ignora un precio que ya es el vigente).
 */
export async function aplicarOfertaAccion(formData: FormData): Promise<void> {
  const { supabase } = await dueno();
  const id = texto(formData.get("productoId"));
  const descuento = Number(texto(formData.get("descuento")));
  if (!/^\d+$/.test(id) || !esDescuentoValido(descuento)) redirect("/ofertas?error=datos");

  const { data: p, error } = await supabase.from("productos_con_precio").select("id, nombre, precio_centavos").eq("id", Number(id)).eq("activo", true).maybeSingle();
  if (error || !p || p.precio_centavos === null) redirect("/ofertas?error=producto");
  const nuevo = precioConOferta(p.precio_centavos, descuento);
  if (nuevo === null || nuevo >= p.precio_centavos) redirect("/ofertas?error=precio");

  const { error: e2 } = await supabase.rpc("cambiar_precios", { p_cambios: [{ producto_id: p.id, precio: nuevo }] });
  if (e2) redirect("/ofertas?error=guardar");

  revalidatePath("/ofertas");
  revalidatePath("/productos");
  revalidatePath("/venta");
  redirect(`/ofertas?ok=oferta&producto=${p.id}`);
}

/** Vuelve al precio de antes de la oferta (el que figura en el historial; nunca uno que mande el navegador). */
export async function quitarOfertaAccion(formData: FormData): Promise<void> {
  const { supabase } = await dueno();
  const id = texto(formData.get("productoId"));
  if (!/^\d+$/.test(id)) redirect("/ofertas?error=datos");

  const { data, error } = await supabase.from("precios_producto").select("precio_centavos, vigente_desde").eq("producto_id", Number(id)).order("vigente_desde", { ascending: false }).order("id", { ascending: false }).limit(2);
  if (error || !data) redirect("/ofertas?error=producto");
  const anterior = precioAnteriorDeOferta(data.map((x) => ({ precio: x.precio_centavos, desde: x.vigente_desde })), Date.now());
  if (anterior === null) redirect("/ofertas?error=sin_oferta");

  const { error: e2 } = await supabase.rpc("cambiar_precios", { p_cambios: [{ producto_id: Number(id), precio: anterior }] });
  if (e2) redirect("/ofertas?error=guardar");

  revalidatePath("/ofertas");
  revalidatePath("/productos");
  revalidatePath("/venta");
  redirect("/ofertas?ok=quitada");
}
