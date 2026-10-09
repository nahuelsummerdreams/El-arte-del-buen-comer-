import { esNoNegativo, leerFilas } from "@/lib/panel";
import type { TipoVenta } from "@/lib/precios";

/**
 * Costos, ganancia, mermas y vencimientos. Funciones puras: números adentro, números o texto afuera.
 * Los costos van igual que los precios: por KILO (productos por peso) o por UNIDAD, en centavos.
 */

const MAX_INT4 = 2_147_483_647;

/**
 * Lo que costó cada kilo (o cada unidad) a partir de lo que se pagó por TODO el lote.
 * Es la misma cuenta que hace la base (redondeo al centavo, mitad hacia arriba, solo con enteros)
 * y sirve para mostrar "equivale a $X el kilo" antes de guardar. null si no cabe en el sistema.
 */
export function costoPorUnidadDeVenta(totalCentavos: number, cantidadBase: number, tipo: TipoVenta): number | null {
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos < 0) return null;
  if (!Number.isSafeInteger(cantidadBase) || cantidadBase <= 0) return null;
  const factor = tipo === "peso" ? BigInt(1000) : BigInt(1);
  const dos = BigInt(2);
  const cant = BigInt(cantidadBase);
  const costo = (BigInt(totalCentavos) * factor * dos + cant) / (dos * cant);
  return costo > BigInt(MAX_INT4) ? null : Number(costo);
}

// ------------------------------------------------------------------ ganancia
export type FilaGanancia = {
  ingresos_con_costo: number;
  costo_vendido: number;
  ingresos_sin_costo: number;
  descuentos: number;
};

export type Ganancia = {
  /** Ganancia estimada = lo vendido con costo conocido − lo que costó − descuentos dados. Puede ser negativa. */
  ganancia: number;
  /** Ganancia sobre lo vendido (neto de descuentos), en %. null si no hay base para calcularlo. */
  margenPct: number | null;
  /** Qué parte de lo vendido tiene costo cargado, en %. null si no hubo ventas. */
  coberturaPct: number | null;
  ingresosSinCosto: number;
};

export function calcularGanancia(f: FilaGanancia): Ganancia {
  const ganancia = f.ingresos_con_costo - f.costo_vendido - f.descuentos;
  const neto = f.ingresos_con_costo - f.descuentos;
  const total = f.ingresos_con_costo + f.ingresos_sin_costo;
  return {
    ganancia,
    margenPct: neto > 0 ? Math.round((ganancia / neto) * 100) : null,
    coberturaPct: total > 0 ? Math.round((f.ingresos_con_costo / total) * 100) : null,
    ingresosSinCosto: f.ingresos_sin_costo,
  };
}

/** Margen de un producto: ganancia sobre el precio de venta, en %. null si no hay precio. */
export function margenDeProducto(precioCentavos: number, costoCentavos: number): number | null {
  if (!(precioCentavos > 0)) return null;
  return Math.round(((precioCentavos - costoCentavos) / precioCentavos) * 100);
}

export const leerResumenGanancia = (datos: unknown): FilaGanancia | null => {
  const filas = leerFilas<FilaGanancia>(datos, (f) =>
    esNoNegativo(f.ingresos_con_costo) && esNoNegativo(f.costo_vendido) && esNoNegativo(f.ingresos_sin_costo) && esNoNegativo(f.descuentos)
      ? { ingresos_con_costo: f.ingresos_con_costo, costo_vendido: f.costo_vendido, ingresos_sin_costo: f.ingresos_sin_costo, descuentos: f.descuentos }
      : null,
  );
  return filas && filas.length === 1 ? filas[0] : null;
};

export type FilaMargen = {
  producto_id: number;
  nombre: string;
  tipo_venta: TipoVenta;
  cantidad: number;
  ingresos_con_costo: number;
  costo_vendido: number;
  ingresos_sin_costo: number;
};

const tipoDe = (v: unknown): TipoVenta | null => (v === "peso" || v === "unidad" ? v : null);

export const leerMargenPorProducto = (datos: unknown) =>
  leerFilas<FilaMargen>(datos, (f) => {
    const tipo = tipoDe(f.tipo_venta);
    return esNoNegativo(f.producto_id) && typeof f.nombre === "string" && tipo && esNoNegativo(f.cantidad) &&
      esNoNegativo(f.ingresos_con_costo) && esNoNegativo(f.costo_vendido) && esNoNegativo(f.ingresos_sin_costo)
      ? { producto_id: f.producto_id, nombre: f.nombre, tipo_venta: tipo, cantidad: f.cantidad, ingresos_con_costo: f.ingresos_con_costo, costo_vendido: f.costo_vendido, ingresos_sin_costo: f.ingresos_sin_costo }
      : null;
  });

// -------------------------------------------------------------------- mermas
export type FilaMerma = {
  producto_id: number;
  nombre: string;
  tipo_venta: TipoVenta;
  cantidad: number;
  costo_centavos: number;
  sin_costo: number;
};

export const leerMermas = (datos: unknown) =>
  leerFilas<FilaMerma>(datos, (f) => {
    const tipo = tipoDe(f.tipo_venta);
    return esNoNegativo(f.producto_id) && typeof f.nombre === "string" && tipo && esNoNegativo(f.cantidad) &&
      esNoNegativo(f.costo_centavos) && esNoNegativo(f.sin_costo)
      ? { producto_id: f.producto_id, nombre: f.nombre, tipo_venta: tipo, cantidad: f.cantidad, costo_centavos: f.costo_centavos, sin_costo: f.sin_costo }
      : null;
  });

// -------------------------------------------------------------- vencimientos
export type FilaVencimiento = {
  lote_id: number;
  producto_id: number;
  nombre: string;
  tipo_venta: TipoVenta;
  quedan: number;
  vence_el: string;
  dias_restantes: number;
};

export const leerVencimientos = (datos: unknown) =>
  leerFilas<FilaVencimiento>(datos, (f) => {
    const tipo = tipoDe(f.tipo_venta);
    return esNoNegativo(f.lote_id) && esNoNegativo(f.producto_id) && typeof f.nombre === "string" && tipo &&
      esNoNegativo(f.quedan) && typeof f.vence_el === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.vence_el) &&
      typeof f.dias_restantes === "number" && Number.isSafeInteger(f.dias_restantes)
      ? { lote_id: f.lote_id, producto_id: f.producto_id, nombre: f.nombre, tipo_venta: tipo, quedan: f.quedan, vence_el: f.vence_el, dias_restantes: f.dias_restantes }
      : null;
  });

export type EstadoVencimiento = "vencido" | "hoy" | "urgente" | "proximo";

/** Qué tan grave es: vencido, vence hoy, vence en 1 a 3 días, o más adelante. */
export function estadoVencimiento(dias: number): EstadoVencimiento {
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  return dias <= 3 ? "urgente" : "proximo";
}

export function textoVencimiento(dias: number): string {
  if (dias < -1) return `Venció hace ${-dias} días`;
  if (dias === -1) return "Venció ayer";
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

// ------------------------------------------------------------ cuentas a pagar
export type FilaDeuda = {
  id: number;
  producto_id: number;
  proveedor_id: number | null;
  costo_total_centavos: number;
  pagar_hasta: string | null;
};

export const leerDeudas = (datos: unknown) =>
  leerFilas<FilaDeuda>(datos, (f) =>
    esNoNegativo(f.id) && esNoNegativo(f.producto_id) && (f.proveedor_id === null || esNoNegativo(f.proveedor_id)) &&
    esNoNegativo(f.costo_total_centavos) &&
    (f.pagar_hasta === null || (typeof f.pagar_hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.pagar_hasta)))
      ? { id: f.id, producto_id: f.producto_id, proveedor_id: f.proveedor_id as number | null, costo_total_centavos: f.costo_total_centavos, pagar_hasta: f.pagar_hasta as string | null }
      : null,
  );

/** Días de calendario entre dos "AAAA-MM-DD" (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  const f = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new RangeError(`Día inválido: «${s}»`);
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  return Math.round((f(hasta) - f(desde)) / 86_400_000);
}

export type EstadoDeuda = { estado: "vencida" | "hoy" | "proxima" | "sin_fecha"; texto: string };

/** Cuándo hay que pagar una deuda, en palabras. Sin fecha límite lo decimos tal cual. */
export function estadoDeuda(pagarHasta: string | null, hoy: string): EstadoDeuda {
  if (pagarHasta === null) return { estado: "sin_fecha", texto: "Sin fecha de pago" };
  const d = diasEntre(hoy, pagarHasta);
  if (d < -1) return { estado: "vencida", texto: `Debías pagarla hace ${-d} días` };
  if (d === -1) return { estado: "vencida", texto: "Debías pagarla ayer" };
  if (d === 0) return { estado: "hoy", texto: "Se paga hoy" };
  if (d === 1) return { estado: "proxima", texto: "Se paga mañana" };
  return { estado: "proxima", texto: `Se paga en ${d} días` };
}
