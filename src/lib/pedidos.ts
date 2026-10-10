import { formatearCantidad, type TipoVenta } from "@/lib/precios";
import { NOMBRE_NEGOCIO } from "@/lib/ticket";

/**
 * Pedido a proveedor: cuánto conviene pedir de cada producto que hay que reponer. La cantidad sugerida
 * sale de lo que se VENDE (ritmo de los últimos 30 días) y del stock mínimo cargado; si no hay datos,
 * no se inventa nada: queda en cero para que la persona elija.
 */

export const DIAS_DE_COBERTURA = 7; // se apunta a tener stock para una semana de ventas
export const VENTANA_VENTAS_DIAS = 30;
const MAX_BASE = { peso: 1_000_000, unidad: 100_000 } as const;

export type MotivoSugerencia = "ritmo" | "minimo" | "sin_datos";
export type Sugerencia = { cantidad: number; motivo: MotivoSugerencia; porDia: number | null };

/**
 * `stock` y `minimo` en la unidad base (gramos o unidades); `vendido` = lo vendido en los últimos
 * `VENTANA_VENTAS_DIAS` días, en la misma unidad. Devuelve la cantidad base a pedir.
 */
export function cantidadSugerida({ stock, minimo, vendido, tipoVenta }: { stock: number; minimo: number; vendido: number; tipoVenta: TipoVenta }): Sugerencia {
  const demandaDiaria = vendido > 0 ? vendido / VENTANA_VENTAS_DIAS : 0;
  const porRitmo = Math.ceil(demandaDiaria * DIAS_DE_COBERTURA);
  const porMinimo = minimo > 0 ? minimo * 2 : 0;
  const objetivo = Math.max(porRitmo, porMinimo);
  if (objetivo === 0) return { cantidad: 0, motivo: "sin_datos", porDia: null };

  const falta = objetivo - Math.max(stock, 0);
  const paso = tipoVenta === "peso" ? 500 : 1; // el kilo se pide de a 500 g
  const redondeada = falta <= 0 ? 0 : Math.ceil(falta / paso) * paso;
  return { cantidad: Math.min(redondeada, MAX_BASE[tipoVenta]), motivo: porRitmo >= porMinimo ? "ritmo" : "minimo", porDia: demandaDiaria > 0 ? Math.round(demandaDiaria) : null };
}

/** Lo que costaría pedir `cantidad` al costo por kilo/unidad conocido (null si no hay costo). */
export function costoDelPedido(cantidad: number, costoUnitario: number | null, tipoVenta: TipoVenta): number | null {
  if (costoUnitario === null || !(cantidad > 0)) return null;
  return tipoVenta === "peso" ? Math.round((cantidad * costoUnitario) / 1000) : cantidad * costoUnitario;
}

export type LineaPedido = { nombre: string; tipoVenta: TipoVenta; cantidad: number };

/** Mensaje listo para mandar por WhatsApp. Las líneas con cantidad cero no se incluyen. */
export function textoPedido(proveedor: string | null, lineas: readonly LineaPedido[]): string {
  const incluidas = lineas.filter((l) => l.cantidad > 0);
  const saludo = proveedor ? `Hola ${proveedor}!` : "Hola!";
  return [
    `${saludo} Quisiera hacer el siguiente pedido:`,
    "",
    ...incluidas.map((l) => `- ${l.nombre}: ${formatearCantidad(l.cantidad, l.tipoVenta)}`),
    "",
    `Gracias. ${NOMBRE_NEGOCIO}`,
  ].join("\n");
}

/** 1500 g → "1,5"; 12 u. → "12". Para mostrar la cantidad en un campo que la persona puede editar. */
export function cantidadATextoEditable(cantidad: number, tipoVenta: TipoVenta): string {
  if (tipoVenta === "unidad") return String(cantidad);
  const kilos = Math.floor(cantidad / 1000);
  const resto = cantidad % 1000;
  return resto === 0 ? String(kilos) : `${kilos},${String(resto).padStart(3, "0").replace(/0+$/, "")}`;
}
