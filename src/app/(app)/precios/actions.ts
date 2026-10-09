"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { armarCambios, leerPorcentaje, REDONDEOS, type RedondeoPesos } from "@/lib/precios-masivos";
import { obtenerSesion } from "@/lib/sesion";

export type EstadoPrecios = { intento: number; mensaje: string | null };

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * Aplica el aumento. El navegador manda SOLO el porcentaje, el redondeo y la categoría: los precios
 * vigentes se leen de la base y las cuentas se rehacen acá. Nunca se confía en una lista de precios
 * armada en el navegador.
 */
export async function aplicarPreciosAccion(previo: EstadoPrecios, formData: FormData): Promise<EstadoPrecios> {
  const intento = previo.intento + 1;

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") return { intento, mensaje: "Solo el dueño puede cambiar precios." };

  const porcentaje = leerPorcentaje(texto(formData.get("porcentaje")));
  if (!porcentaje.ok) return { intento, mensaje: porcentaje.error };

  const redondeo = Number(texto(formData.get("redondeo")));
  if (!REDONDEOS.some((r) => r.pesos === redondeo)) return { intento, mensaje: "Elegí cómo redondear." };

  const catCrudo = texto(formData.get("categoriaId"));
  const categoriaId = catCrudo === "" ? null : /^\d+$/.test(catCrudo) ? Number(catCrudo) : NaN;
  if (Number.isNaN(categoriaId)) return { intento, mensaje: "Categoría inválida." };

  const { data, error } = await sesion.supabase
    .from("productos_con_precio")
    .select("id, nombre, categoria_id, precio_centavos")
    .eq("activo", true);
  if (error) return { intento, mensaje: "No pudimos leer los precios actuales. Intentá de nuevo." };

  const productos = data.flatMap((p) =>
    p.id !== null && p.nombre !== null && p.categoria_id !== null && p.precio_centavos !== null
      ? [{ id: p.id, nombre: p.nombre, categoriaId: p.categoria_id, precio: p.precio_centavos }]
      : [],
  );
  const r = armarCambios(productos, { categoriaId, puntosBasicos: porcentaje.puntosBasicos, redondeo: redondeo as RedondeoPesos });
  if (r.fueraDeRango.length > 0) return { intento, mensaje: `El precio nuevo de ${r.fueraDeRango.join(", ")} no entra en el sistema. No se cambió nada.` };
  if (r.cambios.length === 0) return { intento, mensaje: "Con ese porcentaje ningún precio cambia." };

  const { error: errorRpc } = await sesion.supabase.rpc("cambiar_precios", {
    p_cambios: r.cambios.map((c) => ({ producto_id: c.id, precio: c.nuevo })),
  });
  if (errorRpc) return { intento, mensaje: "No se pudieron guardar los precios. No se cambió nada. Intentá de nuevo." };

  revalidatePath("/productos");
  revalidatePath("/venta");
  redirect(`/precios?listo=${r.cambios.length}`);
}
