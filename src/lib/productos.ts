import { pesosACentavos, type TipoVenta } from "@/lib/precios";

/** Un producto ya validado y convertido, listo para guardarse. */
export type ProductoValidado = {
  categoriaId: number;
  nombre: string;
  codigo: string | null;
  tipoVenta: TipoVenta;
  precioCentavos: number;
};

export type CampoProducto = "categoriaId" | "nombre" | "codigo" | "tipoVenta" | "precio";
export type ErroresProducto = Partial<Record<CampoProducto, string>>;

export type ResultadoValidacion =
  | { ok: true; valores: ProductoValidado }
  | { ok: false; errores: ErroresProducto };

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 80;
const CODIGO_MAX = 40;
const CODIGO_PERMITIDO = /^[\p{L}\p{N}._/-]+$/u; // letras, números y . _ / -

/** FormData.get() puede dar string, File o null: solo nos sirve el texto. */
function texto(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

/**
 * Valida y convierte lo que llega del formulario de "Nuevo producto".
 *
 * Nunca confiamos en lo que manda el navegador: esta validación corre en el SERVIDOR
 * (y la base de datos tiene sus propias restricciones como última defensa).
 * Informa TODOS los errores juntos para que se corrijan de una vez.
 */
export function validarProducto(entrada: Record<string, unknown>): ResultadoValidacion {
  const errores: ErroresProducto = {};

  // --- nombre ---
  const nombreCrudo = texto(entrada.nombre);
  const nombre = (nombreCrudo ?? "").trim().replace(/\s+/g, " "); // junta espacios repetidos
  if (nombre === "") {
    errores.nombre = "Escribí el nombre del producto.";
  } else if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) {
    errores.nombre = `El nombre debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`;
  }

  // --- categoría ---
  const categoriaCruda = texto(entrada.categoriaId)?.trim() ?? "";
  const categoriaId = /^\d+$/.test(categoriaCruda) ? Number(categoriaCruda) : NaN;
  if (!Number.isSafeInteger(categoriaId) || categoriaId < 1) {
    errores.categoriaId = "Elegí una categoría.";
  }

  // --- tipo de venta ---
  const tipo = texto(entrada.tipoVenta);
  const tipoVenta: TipoVenta | null = tipo === "peso" || tipo === "unidad" ? tipo : null;
  if (tipoVenta === null) {
    errores.tipoVenta = "Elegí si se vende por peso o por unidad.";
  }

  // --- código (opcional) ---
  const codigoCrudo = (texto(entrada.codigo) ?? "").trim();
  const codigo = codigoCrudo === "" ? null : codigoCrudo;
  if (codigo !== null && (codigo.length > CODIGO_MAX || !CODIGO_PERMITIDO.test(codigo))) {
    errores.codigo = `Máximo ${CODIGO_MAX} caracteres: letras, números y . _ / -`;
  }

  // --- precio ---
  const precioCrudo = (texto(entrada.precio) ?? "").trim();
  let precioCentavos = 0;
  if (precioCrudo === "") {
    errores.precio = "Escribí el precio.";
  } else {
    try {
      precioCentavos = pesosACentavos(precioCrudo);
      if (precioCentavos === 0) errores.precio = "El precio debe ser mayor a cero.";
    } catch {
      errores.precio = "Precio inválido. Ejemplos: 20.000,50 o 350";
    }
  }

  if (Object.keys(errores).length > 0 || tipoVenta === null) return { ok: false, errores };
  return { ok: true, valores: { categoriaId, nombre, codigo, tipoVenta, precioCentavos } };
}

/** Lo mínimo que usamos de un error de Supabase/PostgREST (así es fácil de probar). */
export type ErrorDeBase = { code?: string; message?: string };

/**
 * Traduce un error de la base de datos al mensaje que ve la persona.
 * Los códigos son los estándar de PostgreSQL (23505 = valor duplicado, 42501 = sin permiso...).
 * El mensaje genérico final NO incluye detalles internos: no le damos pistas sobre la base a nadie.
 */
export function mensajeDeErrorAlGuardar(error: ErrorDeBase): string {
  const detalle = error.message ?? "";

  if (error.code === "23505") {
    if (detalle.includes("productos_nombre_por_categoria_unico")) {
      return "Ya existe un producto con ese nombre en esa categoría.";
    }
    if (detalle.includes("codigo")) return "Ya existe un producto con ese código.";
    return "Ese producto ya existe.";
  }
  if (error.code === "42501") return "No tenés permiso para crear productos.";
  if (error.code === "23503") return "La categoría elegida no existe.";
  if (error.code === "23514") return "Algún dato no es válido. Revisá el formulario.";
  if (detalle.includes("fetch failed")) {
    return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  return "No se pudo guardar el producto. Intentá de nuevo.";
}
