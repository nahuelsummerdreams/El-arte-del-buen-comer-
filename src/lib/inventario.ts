import type { TipoVenta } from "@/lib/precios";

/** Tope por ingreso: ataja errores de tipeo (un cero de más) sin molestar al uso real. */
export const MAX_GRAMOS_POR_INGRESO = 1_000_000; // 1.000 kg
export const MAX_UNIDADES_POR_INGRESO = 100_000;

type MotivoCantidad = "invalida" | "punto" | "cero" | "excede";

/** Error de una cantidad mal escrita, con el motivo para poder explicárselo a la persona. */
export class ErrorDeCantidad extends RangeError {
  constructor(
    readonly motivo: MotivoCantidad,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Convierte lo que escribe una persona a la unidad base que guarda el sistema:
 *  - producto por PESO:   kilos con COMA ("2,5") → gramos enteros (2500)
 *  - producto por UNIDAD: número entero ("12") → 12
 *
 * Decisión de seguridad: en kilos NO se acepta el punto. "2.500" podría leerse como 2,5 kg o como
 * 2.500 kg, y un stock mal cargado cuesta caro. Mejor pedir que lo corrijan.
 */
export function cantidadABase(texto: string, tipoVenta: TipoVenta): number {
  const limpio = texto.trim();

  if (tipoVenta === "unidad") {
    if (!/^\d+$/.test(limpio)) {
      throw new ErrorDeCantidad("invalida", `Cantidad inválida: «${texto}» (se esperaba un número entero)`);
    }
    const sinCeros = limpio.replace(/^0+/, "");
    if (sinCeros === "") throw new ErrorDeCantidad("cero", "La cantidad debe ser mayor a cero");
    if (sinCeros.length > 7 || Number(sinCeros) > MAX_UNIDADES_POR_INGRESO) {
      throw new ErrorDeCantidad("excede", `Máximo ${MAX_UNIDADES_POR_INGRESO} unidades por ingreso`);
    }
    return Number(sinCeros);
  }

  // peso
  if (/^\d+\.\d+$/.test(limpio) || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) {
    throw new ErrorDeCantidad("punto", "Usá coma para los decimales (ejemplo: 2,5)");
  }
  const m = /^(\d+)(?:,(\d{1,3}))?$/.exec(limpio);
  if (!m) throw new ErrorDeCantidad("invalida", `Cantidad inválida: «${texto}» (kilos con coma, ejemplo: 2,5)`);

  const entero = m[1].replace(/^0+/, "");
  const fraccion = (m[2] ?? "").padEnd(3, "0");
  if (entero.length > 7) throw new ErrorDeCantidad("excede", "Máximo 1.000 kg por ingreso");

  const gramos = Number(entero || "0") * 1000 + Number(fraccion);
  if (gramos === 0) throw new ErrorDeCantidad("cero", "La cantidad debe ser mayor a cero");
  if (gramos > MAX_GRAMOS_POR_INGRESO) throw new ErrorDeCantidad("excede", "Máximo 1.000 kg por ingreso");
  return gramos;
}

export type IngresoValidado = {
  productoId: number;
  /** Gramos si el producto es por peso; unidades si es por unidad. Siempre un entero positivo. */
  cantidad: number;
  nota: string | null;
  /** Código único del formulario: evita que un doble envío sume el stock dos veces. */
  clave: string;
};

export type CampoIngreso = "productoId" | "cantidad" | "nota" | "clave";
export type ErroresIngreso = Partial<Record<CampoIngreso, string>>;
export type ResultadoIngreso =
  | { ok: true; valores: IngresoValidado }
  | { ok: false; errores: ErroresIngreso };

const NOTA_MAX = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Valida el formulario de "Ingresar mercadería".
 * `tipoVenta` es el tipo del producto elegido, que el servidor busca en la base (no confiamos en
 * el navegador para eso); es null si el producto no existe o está inactivo.
 */
export function validarIngreso(entrada: Record<string, unknown>, tipoVenta: TipoVenta | null): ResultadoIngreso {
  const errores: ErroresIngreso = {};

  // --- producto ---
  const idCrudo = texto(entrada.productoId).trim();
  const productoId = /^\d+$/.test(idCrudo) ? Number(idCrudo) : NaN;
  if (!Number.isSafeInteger(productoId) || productoId < 1) {
    errores.productoId = "Elegí un producto.";
  } else if (tipoVenta === null) {
    errores.productoId = "Elegí un producto de la lista.";
  }

  // --- cantidad (se interpreta según el tipo del producto) ---
  const cantidadCruda = texto(entrada.cantidad);
  let cantidad = 0;
  if (cantidadCruda.trim() === "") {
    errores.cantidad = "Escribí la cantidad.";
  } else if (tipoVenta !== null) {
    try {
      cantidad = cantidadABase(cantidadCruda, tipoVenta);
    } catch (e) {
      const motivo = e instanceof ErrorDeCantidad ? e.motivo : "invalida";
      errores.cantidad =
        motivo === "cero"
          ? "La cantidad debe ser mayor a cero."
          : motivo === "punto"
            ? "Usá coma para los decimales. Ejemplo: 2,5"
            : motivo === "excede"
              ? tipoVenta === "peso"
                ? "Máximo 1.000 kg por ingreso."
                : "Máximo 100.000 unidades por ingreso."
              : tipoVenta === "peso"
                ? "Cantidad inválida. Escribila en kilos, con coma. Ejemplo: 2,5"
                : "Cantidad inválida. Escribí un número entero de unidades. Ejemplo: 12";
    }
  }

  // --- nota (remito, proveedor, lo que quieras recordar) ---
  const notaCruda = texto(entrada.nota).trim();
  if (notaCruda.length > NOTA_MAX) errores.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;

  // --- clave de idempotencia ---
  const claveCruda = texto(entrada.clave).trim();
  if (!UUID.test(claveCruda)) errores.clave = "El formulario no es válido. Recargá la página e intentá de nuevo.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    valores: {
      productoId,
      cantidad,
      nota: notaCruda === "" ? null : notaCruda,
      clave: claveCruda.toLowerCase(),
    },
  };
}

/** Traduce un error de la base al mensaje que ve la persona (sin exponer detalles internos). */
export function mensajeDeErrorAlRegistrarIngreso(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "No tenés permiso para registrar ingresos.";
  if (error.code === "23503") return "El producto elegido no existe.";
  if ((error.message ?? "").includes("fetch failed")) {
    return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  return "No se pudo registrar el ingreso. Intentá de nuevo.";
}
