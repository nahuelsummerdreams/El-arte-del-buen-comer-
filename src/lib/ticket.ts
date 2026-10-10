import { MEDIOS_DE_PAGO, type MedioPago } from "@/lib/caja";
import { formatearCantidad, formatearPesos, type TipoVenta } from "@/lib/precios";

/**
 * Comprobante de venta: el texto que se manda por WhatsApp. El comprobante NO es una factura fiscal
 * (no pasa por ARCA/AFIP): se dice en el pie, así nadie lo confunde.
 */

export const NOMBRE_NEGOCIO = "El Arte del Buen Comer";
export const PIE_COMPROBANTE = "Comprobante no válido como factura.";

/** El formato de pesos usa espacios "no separables": para texto plano conviene uno común. */
const plano = (s: string) => s.replace(/[  ]/g, " ");

export type LineaComprobante = { nombre: string; tipoVenta: TipoVenta; cantidad: number; precioUnitarioCentavos: number; subtotalCentavos: number };
export type PagoComprobante = { medio: MedioPago; montoCentavos: number };
export type DatosComprobante = {
  numero: number;
  fechaTexto: string;
  lineas: readonly LineaComprobante[];
  subtotalCentavos: number;
  descuentoCentavos: number;
  totalCentavos: number;
  pagos: readonly PagoComprobante[];
};

export const etiquetaMedio = (m: MedioPago) => MEDIOS_DE_PAGO.find((x) => x.valor === m)?.etiqueta ?? m;

export function textoComprobante(d: DatosComprobante): string {
  const lineas = d.lineas.map(
    (l) => `${l.nombre}\n  ${formatearCantidad(l.cantidad, l.tipoVenta)} x ${formatearPesos(l.precioUnitarioCentavos)}${l.tipoVenta === "peso" ? "/kg" : ""} = ${formatearPesos(l.subtotalCentavos)}`,
  );
  const partes = [`${NOMBRE_NEGOCIO}`, `Comprobante N.º ${d.numero}`, d.fechaTexto, "", ...lineas, ""];
  if (d.descuentoCentavos > 0) partes.push(`Subtotal: ${formatearPesos(d.subtotalCentavos)}`, `Descuento: -${formatearPesos(d.descuentoCentavos)}`);
  partes.push(`TOTAL: ${formatearPesos(d.totalCentavos)}`);
  for (const p of d.pagos) partes.push(`${etiquetaMedio(p.medio)}: ${formatearPesos(p.montoCentavos)}`);
  partes.push("", "¡Gracias por tu compra!", PIE_COMPROBANTE);
  return plano(partes.join("\n"));
}

/** Enlace que abre WhatsApp con el mensaje listo (la persona elige a quién mandarlo). */
export function enlaceWhatsApp(texto: string, telefono?: string | null): string {
  const digitos = telefono && /^\+/.test(telefono.trim()) ? telefono.replace(/\D/g, "") : "";
  const base = digitos.length >= 8 && digitos.length <= 15 ? `https://wa.me/${digitos}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(texto.slice(0, 3500))}`;
}
