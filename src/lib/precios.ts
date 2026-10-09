/**
 * Cálculo y formato de precios, cantidades y totales.
 *
 * REGLAS DEL PROYECTO (no las rompas en ningún otro archivo):
 *  - El dinero se maneja SIEMPRE en CENTAVOS ENTEROS. $5.000 = 500000.
 *  - El peso se maneja SIEMPRE en GRAMOS ENTEROS. 1,25 kg = 1250.
 *  - Los números con decimales de JavaScript no son exactos (0.1 + 0.2 = 0.30000000000000004),
 *    y en una caja un centavo de diferencia es un problema. Con enteros no hay ese riesgo.
 *
 * Este archivo es lógica pura: no toca la base de datos ni la red. Por eso es fácil de probar
 * (ver precios.test.ts).
 */

export type TipoVenta = "peso" | "unidad";

export type LineaVenta = {
  /** Gramos si el producto es "peso"; unidades si es "unidad". */
  cantidad: number;
  /** Centavos por KILO si es "peso"; centavos por UNIDAD si es "unidad". */
  precioCentavos: number;
  tipoVenta: TipoVenta;
};

const GRAMOS_POR_KILO = 1000;

function exigirEnteroSeguro(valor: number, nombre: string, minimo: number): void {
  // Number.isSafeInteger rechaza decimales, NaN, Infinity y enteros demasiado grandes para ser exactos.
  if (!Number.isSafeInteger(valor) || valor < minimo) {
    throw new RangeError(`${nombre} inválido: ${valor} (debe ser un entero ≥ ${minimo})`);
  }
}

/**
 * Cuánto cuesta una línea de venta, en centavos enteros.
 *
 *  - Por peso:   gramos × (precio por kilo) ÷ 1000, redondeado al centavo más cercano
 *                (el medio centavo sube: "redondeo comercial").
 *  - Por unidad: unidades × precio.
 *
 * Lanza un error si los datos no son válidos: preferimos NO cobrar antes que cobrar mal.
 */
export function calcularSubtotal({ cantidad, precioCentavos, tipoVenta }: LineaVenta): number {
  exigirEnteroSeguro(cantidad, "La cantidad", 1);
  exigirEnteroSeguro(precioCentavos, "El precio", 0);

  const bruto = cantidad * precioCentavos;
  if (!Number.isSafeInteger(bruto)) {
    throw new RangeError("El importe es demasiado grande para calcularse con exactitud");
  }
  if (tipoVenta === "unidad") return bruto;

  // Redondeo con enteros: sumar medio kilo-centavo y descartar el resto.
  // (n - n % 1000) / 1000 es una división ENTERA exacta; "n / 1000" con decimales no siempre lo es.
  const conMedio = bruto + GRAMOS_POR_KILO / 2;
  if (!Number.isSafeInteger(conMedio)) {
    throw new RangeError("El importe es demasiado grande para calcularse con exactitud");
  }
  return (conMedio - (conMedio % GRAMOS_POR_KILO)) / GRAMOS_POR_KILO;
}

/**
 * Total de un carrito. Cada línea se redondea por separado, igual que en el ticket
 * que ve el cliente (así lo impreso siempre suma lo cobrado).
 */
export function calcularTotal(lineas: readonly LineaVenta[]): number {
  let total = 0;
  for (const linea of lineas) {
    total += calcularSubtotal(linea);
    if (!Number.isSafeInteger(total)) {
      throw new RangeError("El total es demasiado grande para calcularse con exactitud");
    }
  }
  return total;
}

// Se crean una sola vez (crear un Intl.NumberFormat es relativamente caro).
const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const formatoNumero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** 500000 → "$ 5.000,00". Es SOLO para mostrar: nunca calcules con el texto resultante. */
export function formatearPesos(centavos: number): string {
  exigirEnteroSeguro(centavos, "Los centavos", Number.MIN_SAFE_INTEGER);
  return formatoPesos.format(centavos / 100);
}

/** 250 → "250 g", 1250 → "1,25 kg" (peso); 12 → "12 u." (unidad). Solo para mostrar. */
export function formatearCantidad(cantidad: number, tipoVenta: TipoVenta): string {
  exigirEnteroSeguro(cantidad, "La cantidad", 0);
  if (tipoVenta === "unidad") return `${formatoNumero.format(cantidad)} u.`;
  if (cantidad < GRAMOS_POR_KILO) return `${cantidad} g`;
  return `${formatoNumero.format(cantidad / GRAMOS_POR_KILO)} kg`;
}
