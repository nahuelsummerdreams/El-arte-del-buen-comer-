import { MAX_CENTAVOS } from "@/lib/precios";

/**
 * Actualizar precios por porcentaje (inflación, aumento del proveedor). Todo con enteros:
 * el porcentaje se pasa a "puntos básicos" (8,5 % → 850) para no arrastrar errores de decimales.
 */

export const REDONDEOS = [
  { pesos: 1, etiqueta: "Al peso" },
  { pesos: 10, etiqueta: "A los $ 10" },
  { pesos: 100, etiqueta: "A los $ 100" },
] as const;
export type RedondeoPesos = (typeof REDONDEOS)[number]["pesos"];

export const PORCENTAJE_MIN = -90;
export const PORCENTAJE_MAX = 300;

export type ResultadoPorcentaje = { ok: true; puntosBasicos: number } | { ok: false; error: string };

/** "8" → 800, "8,5" → 850, "-3,25" → -325. Solo coma (como en las cantidades); hasta 2 decimales. */
export function leerPorcentaje(texto: string): ResultadoPorcentaje {
  const t = texto.trim().replace(/\s/g, "").replace(/%$/, "");
  if (t === "") return { ok: false, error: "Escribí el porcentaje." };
  if (/^[+-]?\d+\.\d+$/.test(t)) return { ok: false, error: "Usá coma para los decimales. Ejemplo: 8,5" };
  const m = /^([+-])?(\d{1,3})(?:,(\d{1,2}))?$/.exec(t);
  if (!m) return { ok: false, error: "Porcentaje inválido. Ejemplos: 8   8,5   -3" };
  const signo = m[1] === "-" ? -1 : 1;
  const puntos = signo * (Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0")));
  if (puntos === 0) return { ok: false, error: "El porcentaje no puede ser cero." };
  if (puntos < PORCENTAJE_MIN * 100 || puntos > PORCENTAJE_MAX * 100) {
    return { ok: false, error: `El porcentaje debe estar entre ${PORCENTAJE_MIN} y ${PORCENTAJE_MAX}.` };
  }
  return { ok: true, puntosBasicos: puntos };
}

/** Divide redondeando a lo más cercano (mitad hacia arriba), solo con enteros no negativos. */
function dividirRedondeando(num: bigint, den: bigint): bigint {
  const dos = BigInt(2);
  return (num * dos + den) / (den * dos);
}

/**
 * Precio nuevo en centavos, o null si no es posible (el resultado no entra en el sistema).
 * Aplica el porcentaje y redondea al múltiplo de `redondeoPesos` más cercano. Un precio que existe
 * nunca queda en cero: como mínimo, un escalón de redondeo.
 */
export function calcularPrecioNuevo(actualCentavos: number, puntosBasicos: number, redondeoPesos: RedondeoPesos): number | null {
  if (!Number.isSafeInteger(actualCentavos) || actualCentavos < 0) return null;
  if (!Number.isSafeInteger(puntosBasicos)) return null;
  const diezMil = BigInt(10000);
  const factor = diezMil + BigInt(puntosBasicos);
  if (factor <= BigInt(0)) return null;

  const crudo = dividirRedondeando(BigInt(actualCentavos) * factor, diezMil);
  const escalon = BigInt(redondeoPesos * 100);
  let nuevo = dividirRedondeando(crudo, escalon) * escalon;
  if (nuevo === BigInt(0) && actualCentavos > 0) nuevo = escalon;
  return nuevo > BigInt(MAX_CENTAVOS) ? null : Number(nuevo);
}

export type ProductoConPrecio = { id: number; nombre: string; categoriaId: number; precio: number };
export type CambioDePrecio = { id: number; nombre: string; anterior: number; nuevo: number };
export type Ajuste = { categoriaId: number | null; puntosBasicos: number; redondeo: RedondeoPesos };

export type ResultadoCambios = { cambios: CambioDePrecio[]; sinCambio: number; fueraDeRango: string[] };

/** Qué precios cambiarían. Los que quedan igual (por el redondeo) se cuentan aparte; los imposibles se avisan. */
export function armarCambios(productos: readonly ProductoConPrecio[], ajuste: Ajuste): ResultadoCambios {
  const cambios: CambioDePrecio[] = [];
  const fueraDeRango: string[] = [];
  let sinCambio = 0;
  for (const p of productos) {
    if (ajuste.categoriaId !== null && p.categoriaId !== ajuste.categoriaId) continue;
    const nuevo = calcularPrecioNuevo(p.precio, ajuste.puntosBasicos, ajuste.redondeo);
    if (nuevo === null) fueraDeRango.push(p.nombre);
    else if (nuevo === p.precio) sinCambio += 1;
    else cambios.push({ id: p.id, nombre: p.nombre, anterior: p.precio, nuevo });
  }
  cambios.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { cambios, sinCambio, fueraDeRango };
}
