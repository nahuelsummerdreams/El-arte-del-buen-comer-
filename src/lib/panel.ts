import type { MedioPago } from "@/lib/caja";
import { MEDIOS_DE_PAGO } from "@/lib/caja";
import type { TipoVenta } from "@/lib/precios";

/**
 * Cálculos del panel del dueño. Funciones puras (sin base de datos ni pantalla): reciben números,
 * devuelven números o texto, y por eso se pueden probar a fondo.
 */

// ------------------------------------------------------------------ números
/** Variación contra el período anterior, en % entero. null si el anterior no tuvo ventas (no hay base de comparación). */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (!(anterior > 0)) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** Promedio por venta, en centavos. Sin ventas es 0 (nunca NaN ni Infinity). */
export function ticketPromedio(totalCentavos: number, cantidadVentas: number): number {
  return cantidadVentas > 0 ? Math.round(totalCentavos / cantidadVentas) : 0;
}

const unDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** Importes cortos para ejes y tarjetas chicas. RECIBE CENTAVOS: 4480000 → "$ 44,8 mil". */
export function abreviarPesos(centavos: number): string {
  const signo = centavos < 0 ? "-" : "";
  const pesos = Math.abs(centavos) / 100;

  if (Math.round(pesos) < 1000) return `${signo}$ ${Math.round(pesos)}`.replace("-$ 0", "$ 0");

  const miles = Math.round((pesos / 1000) * 10) / 10;
  if (miles < 1000) return `${signo}$ ${unDecimal.format(miles)} mil`;

  const millones = Math.round((pesos / 1_000_000) * 10) / 10;
  return `${signo}$ ${unDecimal.format(millones)} M`;
}

/** Alturas proporcionales para un gráfico de barras. Un valor positivo nunca desaparece (mínimo 2 px). */
export function escalarBarras(valores: readonly number[], alturaMax: number): number[] {
  const maximo = Math.max(0, ...valores);
  if (maximo === 0) return valores.map(() => 0);
  return valores.map((v) => (v <= 0 ? 0 : Math.max(2, Math.round((v / maximo) * alturaMax * 100) / 100)));
}

// -------------------------------------------------------------------- fechas
// Acá las fechas son DÍAS de calendario ("2026-10-09"), sin hora ni zona: se calculan en UTC a
// mediodía para que ninguna zona horaria las corra de día.
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function aFechaUtc(iso: string): Date {
  if (!FORMATO_DIA.test(iso)) throw new RangeError(`Día inválido: «${iso}»`);
  const fecha = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== iso) {
    throw new RangeError(`Día inválido: «${iso}»`);
  }
  return fecha;
}

const diaCorto = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric" });
const diaLargo = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** "2026-10-09" → "vie 9" */
export const etiquetaDiaCorta = (iso: string) => diaCorto.format(aFechaUtc(iso));
/** "2026-10-09" → "viernes 9 de octubre" */
export const etiquetaDiaLarga = (iso: string) => diaLargo.format(aFechaUtc(iso)).replace(",", "");

export function restarDias(iso: string, dias: number): string {
  const fecha = aFechaUtc(iso);
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

// ---------------------------------------- lectura segura de lo que devuelve la base
export type DiaVenta = { dia: string; cantidad: number; total: number; descuentos: number };
export type MedioVendido = { medio: MedioPago; cantidad: number; total: number };
export type ProductoVendido = {
  producto_id: number;
  nombre: string;
  tipo_venta: TipoVenta;
  cantidad: number;
  ingresos: number;
};

const esNoNegativo = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Valida fila por fila; si UNA sola es inválida devuelve null (preferimos no mostrar cifras dudosas). */
function leerFilas<T>(datos: unknown, validar: (f: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(datos)) return null;
  const filas: T[] = [];
  for (const f of datos) {
    const fila = esObjeto(f) ? validar(f) : null;
    if (fila === null) return null;
    filas.push(fila);
  }
  return filas;
}

export const leerVentasPorDia = (datos: unknown) =>
  leerFilas<DiaVenta>(datos, (f) =>
    typeof f.dia === "string" && FORMATO_DIA.test(f.dia) && esNoNegativo(f.cantidad) && esNoNegativo(f.total) && esNoNegativo(f.descuentos)
      ? { dia: f.dia, cantidad: f.cantidad, total: f.total, descuentos: f.descuentos }
      : null,
  );

export const leerVentasPorMedio = (datos: unknown) =>
  leerFilas<MedioVendido>(datos, (f) => {
    const medio = MEDIOS_DE_PAGO.find((m) => m.valor === f.medio)?.valor;
    return medio && esNoNegativo(f.cantidad) && esNoNegativo(f.total) ? { medio, cantidad: f.cantidad, total: f.total } : null;
  });

export const leerMasVendidos = (datos: unknown) =>
  leerFilas<ProductoVendido>(datos, (f) => {
    const tipo = f.tipo_venta === "peso" || f.tipo_venta === "unidad" ? f.tipo_venta : null;
    return esNoNegativo(f.producto_id) && typeof f.nombre === "string" && tipo && esNoNegativo(f.cantidad) && esNoNegativo(f.ingresos)
      ? { producto_id: f.producto_id, nombre: f.nombre, tipo_venta: tipo, cantidad: f.cantidad, ingresos: f.ingresos }
      : null;
  });

// -------------------------------------------------------------- reposición
export type ProductoConStock = { id: number; nombre: string; tipoVenta: TipoVenta; stock: number; stockMinimo: number };
export type ProductoParaReponer = ProductoConStock & { estado: "sin_stock" | "bajo" };

/**
 * Lo que conviene reponer: stock en cero o negativo, o que llegó al mínimo que cargó el dueño.
 * De más urgente (menos stock) a menos urgente.
 */
export function productosParaReponer(productos: readonly ProductoConStock[], limite: number): ProductoParaReponer[] {
  return productos
    .filter((p) => p.stock <= Math.max(p.stockMinimo, 0))
    .map((p) => ({ ...p, estado: p.stock <= 0 ? ("sin_stock" as const) : ("bajo" as const) }))
    .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, limite);
}

// ------------------------------------------------------------- eje vertical
/**
 * Escala "limpia" para el eje vertical de un gráfico: el máximo se redondea hacia ARRIBA a
 * 1, 2, 2,5, 5 o 10 × una potencia de diez, y se reparten 5 marcas parejas (0 … máximo).
 * Todo en centavos. Sin ventas, un eje de $100 para que el gráfico no quede vacío.
 */
export function escalaLimpia(maximoCentavos: number): { max: number; ticks: number[] } {
  if (!(maximoCentavos > 0)) return { max: 10_000, ticks: [0, 2_500, 5_000, 7_500, 10_000] };

  let potencia = 1;
  while (potencia * 10 <= maximoCentavos) potencia *= 10;
  const mantisa = maximoCentavos / potencia; // entre 1 (incluido) y 10 (excluido)
  const paso = [1, 2, 2.5, 5, 10].find((p) => mantisa <= p) ?? 10;

  const max = Math.round(paso * potencia);
  // 5 marcas parejas: 0, ¼, ½, ¾ y el máximo (la última es exactamente `max`).
  return { max, ticks: [0, 1, 2, 3, 4].map((i) => Math.round((max * i) / 4)) };
}

// ------------------------------------------------------------------- avatar
/** "Nicolás Maciel" → "NM" (hasta dos letras). Sin nombre, "?". */
export function iniciales(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => Array.from(palabra)[0].toLocaleUpperCase("es-AR"));
  return letras.length > 0 ? letras.join("") : "?";
}
