import { diaArgentina } from "@/lib/fechas";
import { validarMonto } from "@/lib/metas";
import { restarDias } from "@/lib/panel";
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
  /** Lo que se pagó por TODO el lote, en centavos. null si no se quiere anotar. */
  costoTotalCentavos: number | null;
  /** Fecha de vencimiento "AAAA-MM-DD", o null. */
  venceEl: string | null;
  proveedorId: number | null;
  /** false = se compró a cuenta: queda en "cuentas a pagar". */
  pagado: boolean;
  pagarHasta: string | null;
};

export type CampoIngreso =
  | "productoId" | "cantidad" | "nota" | "clave"
  | "costoTotal" | "vence" | "proveedorId" | "pagado" | "pagarHasta";
export type ErroresIngreso = Partial<Record<CampoIngreso, string>>;
export type ResultadoIngreso =
  | { ok: true; valores: IngresoValidado }
  | { ok: false; errores: ErroresIngreso };

const NOTA_MAX = 200;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha futura (o de hoy), hasta 10 años adelante. Devuelve el error o null si está bien. */
function errorDeFechaFutura(valor: string, hoy: string, mensajePasada: string): string | null {
  if (!FECHA.test(valor)) return "Fecha inválida.";
  try {
    restarDias(valor, 0); // lanza si el día no existe (por ejemplo 2026-02-30)
  } catch {
    return "Fecha inválida.";
  }
  if (valor < hoy) return mensajePasada;
  if (valor > restarDias(hoy, -3650)) return "La fecha está demasiado lejos.";
  return null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown) => (typeof v === "string" ? v : "");


/** Lee una cantidad escrita por una persona según el tipo del producto, con el mensaje de error listo para mostrar. */
function leerCantidad(cruda: string, tipoVenta: TipoVenta | null): { cantidad: number } | { error: string } | null {
  if (cruda.trim() === "") return { error: "Escribí la cantidad." };
  if (tipoVenta === null) return null; // sin tipo de producto no se puede interpretar; el error es el del producto
  try {
    return { cantidad: cantidadABase(cruda, tipoVenta) };
  } catch (e) {
    const motivo = e instanceof ErrorDeCantidad ? e.motivo : "invalida";
    return {
      error:
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
                : "Cantidad inválida. Escribí un número entero de unidades. Ejemplo: 12",
    };
  }
}

/**
 * Valida el formulario de "Ingresar mercadería".
 * `tipoVenta` es el tipo del producto elegido, que el servidor busca en la base (no confiamos en
 * el navegador para eso); es null si el producto no existe o está inactivo.
 */
export function validarIngreso(
  entrada: Record<string, unknown>,
  tipoVenta: TipoVenta | null,
  hoy: string = diaArgentina(new Date()),
): ResultadoIngreso {
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
  const c = leerCantidad(texto(entrada.cantidad), tipoVenta);
  if (c && "error" in c) errores.cantidad = c.error;
  const cantidad = c && "cantidad" in c ? c.cantidad : 0;

  // --- nota (remito, proveedor, lo que quieras recordar) ---
  const notaCruda = texto(entrada.nota).trim();
  if (notaCruda.length > NOTA_MAX) errores.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;

  // --- costo total del lote (opcional) ---
  let costoTotalCentavos: number | null = null;
  const costoCrudo = texto(entrada.costoTotal).trim();
  if (costoCrudo !== "") {
    const m = validarMonto(costoCrudo, { permitirCero: true });
    if (m.ok) costoTotalCentavos = m.centavos;
    else errores.costoTotal = m.error;
  }

  // --- vencimiento (opcional) ---
  const venceCrudo = texto(entrada.vence).trim();
  let venceEl: string | null = null;
  if (venceCrudo !== "") {
    const e = errorDeFechaFutura(venceCrudo, hoy, "Esa fecha de vencimiento ya pasó.");
    if (e) errores.vence = e;
    else venceEl = venceCrudo;
  }

  // --- proveedor (opcional) ---
  const provCrudo = texto(entrada.proveedorId).trim();
  let proveedorId: number | null = null;
  if (provCrudo !== "") {
    if (/^\d+$/.test(provCrudo) && Number.isSafeInteger(Number(provCrudo)) && Number(provCrudo) >= 1) proveedorId = Number(provCrudo);
    else errores.proveedorId = "Elegí un proveedor de la lista.";
  }

  // --- pago: por defecto está pagado; "no" lo deja como deuda ---
  const pagadoCrudo = texto(entrada.pagado).trim();
  const pagado = pagadoCrudo !== "no";
  if (pagadoCrudo !== "" && pagadoCrudo !== "si" && pagadoCrudo !== "no") errores.pagado = "Elegí si ya está pagado o no.";
  const pagarCrudo = texto(entrada.pagarHasta).trim();
  let pagarHasta: string | null = null;
  if (!pagado) {
    if (costoTotalCentavos === null && !errores.costoTotal) errores.costoTotal = "Para anotar una deuda hace falta el costo del lote.";
    if (pagarCrudo !== "") {
      const e = errorDeFechaFutura(pagarCrudo, hoy, "Esa fecha de pago ya pasó.");
      if (e) errores.pagarHasta = e;
      else pagarHasta = pagarCrudo;
    }
  }

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
      costoTotalCentavos,
      venceEl,
      proveedorId,
      pagado,
      pagarHasta,
    },
  };
}

/** Traduce un error de la base al mensaje que ve la persona (sin exponer detalles internos). */
export function mensajeDeErrorAlRegistrarIngreso(error: { code?: string; message?: string }): string {
  const m = error.message ?? "";
  if (error.code === "42501" || m === "solo_dueno") return "No tenés permiso para registrar ingresos.";
  if (error.code === "23503" || m === "producto_no_encontrado") return "El producto elegido no existe.";
  if (m === "proveedor_no_encontrado") return "El proveedor elegido no existe.";
  if (m === "vencimiento_pasado") return "Esa fecha de vencimiento ya pasó.";
  if (m === "costo_fuera_de_rango") return "El costo es demasiado grande para esa cantidad. Revisá los números.";
  if (m === "deuda_sin_costo") return "Para anotar una deuda hace falta el costo del lote.";
  if (m.includes("fetch failed")) return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  return "No se pudo registrar el ingreso. Intentá de nuevo.";
}

// ------------------------------------------------------------------- mermas
export const MOTIVOS_MERMA = [
  "Vencido",
  "Se echó a perder",
  "Recorte o corte de más",
  "Rotura o accidente",
  "Faltante sin explicar",
  "Otro motivo",
] as const;

export type MermaValidada = { productoId: number; cantidad: number; motivo: string; clave: string };
export type CampoMerma = "productoId" | "cantidad" | "motivo" | "detalle" | "clave";
export type ErroresMerma = Partial<Record<CampoMerma, string>>;
export type ResultadoMerma = { ok: true; valores: MermaValidada } | { ok: false; errores: ErroresMerma };

const DETALLE_MAX = 120;

/** Valida "Registrar pérdida". El motivo se elige de una lista y puede llevar un detalle. */
export function validarMerma(entrada: Record<string, unknown>, tipoVenta: TipoVenta | null): ResultadoMerma {
  const errores: ErroresMerma = {};

  const idCrudo = texto(entrada.productoId).trim();
  const productoId = /^\d+$/.test(idCrudo) ? Number(idCrudo) : NaN;
  if (!Number.isSafeInteger(productoId) || productoId < 1) errores.productoId = "Elegí un producto.";
  else if (tipoVenta === null) errores.productoId = "Elegí un producto de la lista.";

  const c = leerCantidad(texto(entrada.cantidad), tipoVenta);
  if (c && "error" in c) errores.cantidad = c.error.replace("por ingreso", "por registro");
  const cantidad = c && "cantidad" in c ? c.cantidad : 0;

  const motivoElegido = texto(entrada.motivo).trim();
  const detalle = texto(entrada.detalle).trim();
  if (!(MOTIVOS_MERMA as readonly string[]).includes(motivoElegido)) errores.motivo = "Elegí el motivo.";
  if (detalle.length > DETALLE_MAX) errores.detalle = `El detalle admite hasta ${DETALLE_MAX} caracteres.`;
  if (motivoElegido === "Otro motivo" && detalle === "") errores.detalle = "Contanos qué pasó.";

  const claveCruda = texto(entrada.clave).trim();
  if (!UUID.test(claveCruda)) errores.clave = "El formulario no es válido. Recargá la página e intentá de nuevo.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    valores: {
      productoId,
      cantidad,
      motivo: detalle === "" ? motivoElegido : `${motivoElegido}: ${detalle}`,
      clave: claveCruda.toLowerCase(),
    },
  };
}

export function mensajeDeErrorAlRegistrarMerma(error: { code?: string; message?: string }): string {
  const m = error.message ?? "";
  if (error.code === "42501" || m === "solo_dueno") return "No tenés permiso para registrar pérdidas.";
  if (m === "producto_no_encontrado") return "El producto elegido no existe.";
  if (m.includes("fetch failed")) return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  return "No se pudo registrar la pérdida. Intentá de nuevo.";
}
