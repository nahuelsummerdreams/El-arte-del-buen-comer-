import type { MedioPago } from "@/lib/caja";
import { cantidadABase, ErrorDeCantidad } from "@/lib/inventario";
import { calcularSubtotal, pesosACentavos, type TipoVenta } from "@/lib/precios";

/** Los topes son los MISMOS que valida la base de datos (registrar_venta). */
export const MAX_CANTIDAD_PESO = 1_000_000; // gramos = 1.000 kg por línea
export const MAX_CANTIDAD_UNIDAD = 100_000;
export const MAX_LINEAS = 100;

/**
 * Lo que el carrito sabe de un producto. El precio es SOLO para mostrar el total en pantalla:
 * al cobrar, el servidor ignora los precios del navegador y usa los de la base.
 */
export type ProductoVendible = {
  id: number;
  nombre: string;
  tipoVenta: TipoVenta;
  precioCentavos: number;
};

/** Cantidad en gramos (peso) o unidades (unidad). */
export type LineaCarrito = { producto: ProductoVendible; cantidad: number };

const maximoPara = (t: TipoVenta) => (t === "peso" ? MAX_CANTIDAD_PESO : MAX_CANTIDAD_UNIDAD);

function exigirCantidad(cantidad: number, tipo: TipoVenta): void {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) {
    throw new RangeError(`Cantidad inválida: ${cantidad}`);
  }
  if (cantidad > maximoPara(tipo)) {
    throw new RangeError(`Cantidad demasiado grande: ${cantidad} (máximo ${maximoPara(tipo)})`);
  }
}

/** Agrega al carrito. Si el producto ya estaba, SUMA la cantidad en su misma línea. No modifica el original. */
export function agregarAlCarrito(
  carrito: readonly LineaCarrito[],
  producto: ProductoVendible,
  cantidad: number,
): LineaCarrito[] {
  exigirCantidad(cantidad, producto.tipoVenta);
  const existente = carrito.find((l) => l.producto.id === producto.id);
  if (existente) {
    const suma = existente.cantidad + cantidad;
    exigirCantidad(suma, producto.tipoVenta);
    return carrito.map((l) => (l.producto.id === producto.id ? { ...l, cantidad: suma } : l));
  }
  if (carrito.length >= MAX_LINEAS) throw new RangeError(`El carrito admite hasta ${MAX_LINEAS} productos distintos`);
  return [...carrito, { producto, cantidad }];
}

/** Reemplaza la cantidad de una línea (0 la quita). Si el producto no está, no cambia nada. */
export function cambiarCantidad(
  carrito: readonly LineaCarrito[],
  productoId: number,
  cantidad: number,
): LineaCarrito[] {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) throw new RangeError(`Cantidad inválida: ${cantidad}`);
  if (cantidad === 0) return quitarDelCarrito(carrito, productoId);
  const linea = carrito.find((l) => l.producto.id === productoId);
  if (!linea) return [...carrito];
  exigirCantidad(cantidad, linea.producto.tipoVenta);
  return carrito.map((l) => (l.producto.id === productoId ? { ...l, cantidad } : l));
}

export function quitarDelCarrito(carrito: readonly LineaCarrito[], productoId: number): LineaCarrito[] {
  return carrito.filter((l) => l.producto.id !== productoId);
}

/** Suma de las líneas; cada una se redondea por separado, igual que en la base y en el ticket. */
export function subtotalCarrito(carrito: readonly LineaCarrito[]): number {
  return carrito.reduce(
    (suma, l) =>
      suma +
      calcularSubtotal({ cantidad: l.cantidad, precioCentavos: l.producto.precioCentavos, tipoVenta: l.producto.tipoVenta }),
    0,
  );
}

export function totalConDescuento(subtotal: number, descuento: number): number {
  if (!Number.isSafeInteger(descuento) || descuento < 0 || descuento > subtotal) {
    throw new RangeError(`Descuento inválido: ${descuento}`);
  }
  return subtotal - descuento;
}

export type ResultadoDescuento = { ok: true; centavos: number } | { ok: false; error: string };

/** Interpreta el descuento escrito por el dueño. Vacío = sin descuento. */
export function validarDescuento(texto: string, subtotal: number): ResultadoDescuento {
  const crudo = texto.trim();
  if (crudo === "") return { ok: true, centavos: 0 };
  let centavos: number;
  try {
    centavos = pesosACentavos(crudo);
  } catch {
    return { ok: false, error: "Descuento inválido. Ejemplos: 500 o 1.000,50" };
  }
  // La base exige que el total quede mayor a cero, así que el descuento tiene que ser MENOR al subtotal.
  if (centavos >= subtotal && centavos > 0) return { ok: false, error: "El descuento tiene que ser menor al subtotal." };
  return { ok: true, centavos };
}

export type VentaParaEnviar = {
  /** Solo producto y cantidad: los precios los pone el servidor. */
  items: { producto_id: number; cantidad: number }[];
  pagos: { medio: MedioPago; monto: number }[];
  descuentoCentavos: number;
};

export function armarVenta(carrito: readonly LineaCarrito[], medio: MedioPago, descuentoCentavos: number): VentaParaEnviar {
  if (carrito.length === 0) throw new RangeError("El carrito está vacío");
  const total = totalConDescuento(subtotalCarrito(carrito), descuentoCentavos);
  if (total <= 0) throw new RangeError("El total tiene que ser mayor a cero");
  return {
    items: carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    pagos: [{ medio, monto: total }],
    descuentoCentavos,
  };
}

export type ResultadoVuelto = { ok: true; vuelto: number } | { ok: false; falta: number };

export function calcularVuelto(total: number, recibido: number): ResultadoVuelto {
  return recibido >= total ? { ok: true, vuelto: recibido - total } : { ok: false, falta: total - recibido };
}

/** Traduce el error de la base al mensaje que ve el cajero (sin detalles internos). */
export function mensajeDeErrorDeVenta(error: { code?: string; message?: string }): string {
  const m = error.message ?? "";
  if (m.includes("caja_cerrada")) return "No hay una caja abierta. Abrí la caja para vender.";
  if (m.includes("pagos_no_coinciden")) {
    return "Los precios cambiaron mientras armabas la venta. Actualizá la pantalla y volvé a cobrar.";
  }
  if (m.includes("producto_invalido")) return "Un producto del carrito ya no está disponible. Actualizá la pantalla.";
  if (m.includes("producto_sin_precio")) return "Un producto del carrito quedó sin precio. Avisale al dueño.";
  if (m.includes("descuento_no_autorizado")) return "Solo el dueño puede aplicar descuentos.";
  if (m.includes("descuento_invalido") || m.includes("total_invalido")) return "El descuento no es válido.";
  if (m.includes("carrito_vacio")) return "El carrito está vacío.";
  if (m.includes("importe_demasiado_grande")) return "El importe es demasiado grande.";
  if (m.includes("item_invalido") || m.includes("carrito_demasiado_grande")) {
    return "Alguna cantidad del carrito no es válida. Revisala.";
  }
  if (m.includes("fetch failed")) {
    return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  return "No se pudo registrar la venta. Intentá de nuevo.";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INTEGER_BASE = 2_147_483_647;
const MEDIOS: readonly MedioPago[] = ["efectivo", "tarjeta", "transferencia", "billetera"];

export type EnvioVentaValidado = {
  items: { producto_id: number; cantidad: number }[];
  pagos: { medio: MedioPago; monto: number }[];
  descuento: number;
  clave: string;
};
export type ResultadoEnvioVenta = { ok: true; valores: EnvioVentaValidado } | { ok: false; mensaje: string };

const INVALIDO = "Los datos de la venta no son válidos. Recargá la pantalla e intentá de nuevo.";
const esEntero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const textoEntero = (v: unknown): number | null =>
  typeof v === "string" && /^\d{1,10}$/.test(v.trim()) ? Number(v.trim()) : null;

/**
 * Valida lo que el navegador manda al servidor al cobrar. NUNCA se confía en este envío:
 *  - de cada renglón solo se conserva producto y cantidad (si trajera un precio, se descarta);
 *  - el "total" que mandó el navegador sirve únicamente como CONFIRMACIÓN de precio: la base
 *    calcula el total real y si no coincide, rechaza la venta.
 */
export function validarEnvioVenta(entrada: Record<string, unknown>): ResultadoEnvioVenta {
  let crudo: unknown;
  try {
    crudo = typeof entrada.items === "string" ? JSON.parse(entrada.items) : null;
  } catch {
    return { ok: false, mensaje: INVALIDO };
  }
  if (!Array.isArray(crudo) || crudo.length < 1 || crudo.length > MAX_LINEAS) return { ok: false, mensaje: INVALIDO };

  const items: EnvioVentaValidado["items"] = [];
  for (const it of crudo) {
    if (typeof it !== "object" || it === null || Array.isArray(it)) return { ok: false, mensaje: INVALIDO };
    const { producto_id, cantidad } = it as Record<string, unknown>;
    if (!esEntero(producto_id) || producto_id < 1 || !esEntero(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD_PESO) {
      return { ok: false, mensaje: INVALIDO };
    }
    items.push({ producto_id, cantidad }); // a propósito: se descarta cualquier otro campo
  }

  const medio = MEDIOS.find((m) => m === entrada.medio);
  const total = textoEntero(entrada.total);
  const descuento = entrada.descuento === "" ? 0 : textoEntero(entrada.descuento);
  const clave = typeof entrada.clave === "string" ? entrada.clave.trim() : "";

  if (!medio || total === null || total < 1 || total > MAX_INTEGER_BASE) return { ok: false, mensaje: INVALIDO };
  if (descuento === null || descuento > MAX_INTEGER_BASE || !UUID.test(clave)) return { ok: false, mensaje: INVALIDO };

  return { ok: true, valores: { items, pagos: [{ medio, monto: total }], descuento, clave: clave.toLowerCase() } };
}

export type ResultadoKilos = { ok: true; gramos: number } | { ok: false; error: string };

/** Kilos escritos en el mostrador ("0,350") → gramos enteros. Misma regla que el ingreso de mercadería. */
export function leerKilos(texto: string): ResultadoKilos {
  if (texto.trim() === "") return { ok: false, error: "Escribí la cantidad en kilos. Ejemplo: 0,350" };
  try {
    return { ok: true, gramos: cantidadABase(texto, "peso") };
  } catch (e) {
    const motivo = e instanceof ErrorDeCantidad ? e.motivo : "invalida";
    const error =
      motivo === "punto" ? "Usá coma para los decimales. Ejemplo: 0,350"
      : motivo === "cero" ? "La cantidad debe ser mayor a cero."
      : motivo === "excede" ? "Máximo 1.000 kg por producto."
      : "Cantidad inválida. Escribí los kilos con coma. Ejemplo: 0,350";
    return { ok: false, error };
  }
}
