import { calcularPrecioNuevo } from "@/lib/precios-masivos";
import { formatearPesos, formatearStock, type TipoVenta } from "@/lib/precios";
import type { FilaVencimiento } from "@/lib/costos";

/**
 * Ofertas por vencimiento: cuánto conviene bajar el precio de lo que está por vencerse, sin perder de
 * vista el costo. Cuanto menos tiempo queda, más fuerte el descuento sugerido. Lo ya vencido NO se
 * ofrece: se retira (Registrar pérdida).
 */

export const DESCUENTOS = [10, 15, 20, 30, 40, 50] as const;
export type Descuento = (typeof DESCUENTOS)[number];

export const VENTANA_OFERTAS_DIAS = 14;

/** Descuento sugerido según los días que quedan (null = no corresponde oferta). */
export function descuentoSugerido(diasRestantes: number): Descuento | null {
  if (!Number.isFinite(diasRestantes) || diasRestantes < 0) return null; // ya venció: se retira
  if (diasRestantes === 0) return 50;
  if (diasRestantes === 1) return 40;
  if (diasRestantes <= 3) return 30;
  if (diasRestantes <= 7) return 20;
  if (diasRestantes <= 14) return 10;
  return null;
}

export const esDescuentoValido = (v: unknown): v is Descuento => typeof v === "number" && (DESCUENTOS as readonly number[]).includes(v);

/** Precio con el descuento aplicado, redondeado a los $ 10 más cercanos. null si no entra en el sistema. */
export function precioConOferta(precioCentavos: number, descuento: Descuento): number | null {
  return calcularPrecioNuevo(precioCentavos, -descuento * 100, 10);
}

export type MargenOferta = { margenPct: number | null; pierde: boolean };

/** Qué margen deja el precio de oferta sobre el costo. `pierde` = queda por debajo del costo. */
export function margenDeOferta(precioOferta: number, costoCentavos: number | null): MargenOferta {
  if (costoCentavos === null) return { margenPct: null, pierde: false };
  if (!(precioOferta > 0)) return { margenPct: null, pierde: costoCentavos > 0 };
  return { margenPct: Math.round(((precioOferta - costoCentavos) / precioOferta) * 100), pierde: precioOferta < costoCentavos };
}

export type ProductoOferta = { id: number; nombre: string; tipoVenta: TipoVenta; precio: number | null };

export type FilaOferta = {
  productoId: number;
  nombre: string;
  tipoVenta: TipoVenta;
  quedan: number;
  venceEl: string;
  diasRestantes: number;
  precio: number | null;
  costo: number | null;
  sugerido: Descuento | null;
};

/** Junta los lotes de cada producto (se toma el que vence primero) y calcula el descuento sugerido. */
export function armarOfertas(vencimientos: readonly FilaVencimiento[], productos: readonly ProductoOferta[], costos: ReadonlyMap<number, number>): FilaOferta[] {
  const porProducto = new Map<number, FilaOferta>();
  const info = new Map(productos.map((p) => [p.id, p]));
  for (const v of vencimientos) {
    const p = info.get(v.producto_id);
    if (!p) continue;
    const previo = porProducto.get(v.producto_id);
    if (!previo) {
      porProducto.set(v.producto_id, {
        productoId: v.producto_id, nombre: p.nombre, tipoVenta: p.tipoVenta, quedan: v.quedan, venceEl: v.vence_el,
        diasRestantes: v.dias_restantes, precio: p.precio, costo: costos.get(v.producto_id) ?? null, sugerido: descuentoSugerido(v.dias_restantes),
      });
    } else if (v.dias_restantes < previo.diasRestantes) {
      porProducto.set(v.producto_id, { ...previo, quedan: v.quedan, venceEl: v.vence_el, diasRestantes: v.dias_restantes, sugerido: descuentoSugerido(v.dias_restantes) });
    }
  }
  // Primero lo que vence antes (los ya vencidos, arriba: hay que retirarlos).
  return [...porProducto.values()].sort((a, b) => a.diasRestantes - b.diasRestantes || a.nombre.localeCompare(b.nombre, "es"));
}

/** Texto para el cartel o para mandar por WhatsApp. */
export function textoCartel(f: { nombre: string; tipoVenta: TipoVenta; precioAnterior: number; precioOferta: number; descuento: number; quedan: number }): string {
  const unidad = f.tipoVenta === "peso" ? " el kilo" : " cada una";
  return `OFERTA: ${f.nombre}\n${formatearPesos(f.precioOferta)}${unidad} (antes ${formatearPesos(f.precioAnterior)}, ${f.descuento}% menos)\nHasta agotar stock: quedan ${formatearStock(f.quedan, f.tipoVenta)}.`.replace(/[  ]/g, " ");
}

/**
 * Para «volver al precio de antes»: si el último cambio de precio fue una BAJA reciente, devuelve el
 * precio anterior. `historial` viene del más nuevo al más viejo: [{precio, desde}].
 */
export function precioAnteriorDeOferta(historial: readonly { precio: number; desde: string }[], ahoraMs: number, diasMax = 21): number | null {
  if (historial.length < 2) return null;
  const [actual, previo] = historial;
  const edadDias = (ahoraMs - new Date(actual.desde).getTime()) / 86_400_000;
  return previo.precio > actual.precio && edadDias <= diasMax ? previo.precio : null;
}
