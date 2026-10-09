"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorAlGuardar, validarProducto, type ErroresProducto } from "@/lib/productos";

/** Lo que el formulario envió, tal cual, para volver a mostrarlo si algo salió mal. */
export type ValoresFormulario = {
  nombre: string;
  categoriaId: string;
  tipoVenta: string;
  precio: string;
  codigo: string;
};

export type EstadoProducto = {
  /**
   * Número de respuesta. Cambia en cada envío y el formulario lo usa como `key`: React 19 reinicia
   * el formulario al terminar la acción, y un <select> no recupera su valor por defecto después de
   * haberse dibujado una vez. Con una key nueva, los campos se vuelven a crear con los valores enviados.
   */
  intento: number;
  errores: ErroresProducto;
  /** Error general (no de un campo): sin permiso, falla de la base, etc. */
  mensaje: string | null;
  valores: ValoresFormulario;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function crearProductoAccion(
  estadoPrevio: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  const intento = estadoPrevio.intento + 1;
  const valores: ValoresFormulario = {
    nombre: texto(formData.get("nombre")),
    categoriaId: texto(formData.get("categoriaId")),
    tipoVenta: texto(formData.get("tipoVenta")),
    precio: texto(formData.get("precio")),
    codigo: texto(formData.get("codigo")),
  };

  // 1) Identidad y permiso, DENTRO de la acción: una Server Action es una puerta pública
  //    que cualquiera puede llamar directamente, aunque la página que la muestra esté protegida.
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") {
    return { intento, errores: {}, mensaje: "Solo el dueño puede crear productos.", valores };
  }

  // 2) Validación en el servidor (nunca confiamos en lo que manda el navegador).
  const resultado = validarProducto(valores);
  if (!resultado.ok) return { intento, errores: resultado.errores, mensaje: null, valores };

  // 3) Guardado atómico: producto + primer precio en una sola transacción (función de la base).
  const v = resultado.valores;
  const { error } = await sesion.supabase.rpc("crear_producto", {
    p_categoria_id: v.categoriaId,
    p_nombre: v.nombre,
    p_codigo: v.codigo ?? "", // la función convierte "" en NULL
    p_tipo_venta: v.tipoVenta,
    p_precio_centavos: v.precioCentavos,
  });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorAlGuardar(error), valores };

  // 4) Refrescar la lista y volver a ella (redirect va al final y fuera de try/catch).
  revalidatePath("/productos");
  redirect("/productos?creado=1");
}
