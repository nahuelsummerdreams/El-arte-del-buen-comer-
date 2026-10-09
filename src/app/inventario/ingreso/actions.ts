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

  // 4) Registro en el libro de stock. La clave única hace que un doble envío no sume dos veces.
  const { error } = await sesion.supabase.from("movimientos_stock").insert({
    producto_id: v.productoId,
    tipo: "ingreso",
    cantidad: v.cantidad,
    motivo: v.nota,
    usuario_id: sesion.user.id,
    clave_idempotencia: v.clave,
  });

  if (error) {
    // Si la clave ya existe, ESTE mismo ingreso ya se registró (reintento o doble clic):
    // no es un error, seguimos como si recién se hubiera guardado.
    const yaRegistrado = error.code === "23505" && error.message.includes("movimientos_stock_clave_unica");
    if (!yaRegistrado) {
      return { intento, errores: {}, mensaje: mensajeDeErrorAlRegistrarIngreso(error), valores };
    }
  }

  revalidatePath("/productos");
  redirect("/productos?ingreso=1");
}
