import { pesosACentavos } from "@/lib/precios";

export type MedioPago = "efectivo" | "tarjeta" | "transferencia" | "billetera";

/** Los medios de pago que acepta el negocio, en el orden en que se muestran. */
export const MEDIOS_DE_PAGO: readonly { valor: MedioPago; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "billetera", etiqueta: "Billetera virtual" },
];

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const FORMATO_IMPORTE = "Importe inválido. Ejemplos: 5.000 o 5.000,50";
const NOTA_MAX = 200;

/** Convierte un importe escrito a centavos; devuelve null si no es válido. El 0 es válido. */
function importe(crudo: string): number | null {
  try {
    return pesosACentavos(crudo);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- apertura
export type ResultadoApertura =
  | { ok: true; valores: { efectivoInicial: number } }
  | { ok: false; errores: { efectivoInicial?: string } };

export function validarApertura(entrada: Record<string, unknown>): ResultadoApertura {
  const crudo = texto(entrada.efectivoInicial).trim();
  if (crudo === "") {
    // Obligamos a escribirlo: así nadie abre la caja "sin querer" con un valor por defecto.
    return { ok: false, errores: { efectivoInicial: "Escribí con cuánto efectivo abrís la caja (si es cero, escribí 0)." } };
  }
  const centavos = importe(crudo);
  if (centavos === null) return { ok: false, errores: { efectivoInicial: FORMATO_IMPORTE } };
  return { ok: true, valores: { efectivoInicial: centavos } };
}

// ------------------------------------------------------------------ cierre
export type ResultadoCierre =
  | { ok: true; valores: { efectivoContado: number; nota: string | null } }
  | { ok: false; errores: { efectivoContado?: string; nota?: string } };

export function validarCierre(entrada: Record<string, unknown>): ResultadoCierre {
  const errores: { efectivoContado?: string; nota?: string } = {};
  const crudo = texto(entrada.efectivoContado).trim();
  let contado = 0;
  if (crudo === "") {
    errores.efectivoContado = "Escribí cuánto efectivo contaste (si no hay nada, escribí 0).";
  } else {
    const c = importe(crudo);
    if (c === null) errores.efectivoContado = FORMATO_IMPORTE;
    else contado = c;
  }
  const nota = texto(entrada.nota).trim();
  if (nota.length > NOTA_MAX) errores.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valores: { efectivoContado: contado, nota: nota === "" ? null : nota } };
}

// ------------------------------------------------- retiros, gastos, ingresos
export type TipoMovimientoCaja = "retiro" | "gasto" | "ingreso";
export const TIPOS_MOVIMIENTO_CAJA: readonly TipoMovimientoCaja[] = ["retiro", "gasto", "ingreso"];

export type ResultadoMovimiento =
  | { ok: true; valores: { tipo: TipoMovimientoCaja; montoCentavos: number; motivo: string } }
  | { ok: false; errores: { tipo?: string; monto?: string; motivo?: string } };

export function validarMovimientoCaja(entrada: Record<string, unknown>): ResultadoMovimiento {
  const errores: { tipo?: string; monto?: string; motivo?: string } = {};

  const tipoCrudo = texto(entrada.tipo);
  const tipo = TIPOS_MOVIMIENTO_CAJA.find((t) => t === tipoCrudo);
  if (!tipo) errores.tipo = "Elegí el tipo de movimiento.";

  const montoCrudo = texto(entrada.monto).trim();
  let montoCentavos = 0;
  if (montoCrudo === "") {
    errores.monto = "Escribí el monto.";
  } else {
    const m = importe(montoCrudo);
    if (m === null) errores.monto = FORMATO_IMPORTE;
    else if (m === 0) errores.monto = "El monto debe ser mayor a cero.";
    else montoCentavos = m;
  }

  const motivo = texto(entrada.motivo).trim().replace(/\s+/g, " ");
  if (motivo.length < 3 || motivo.length > 120) errores.motivo = "Escribí el motivo (entre 3 y 120 caracteres).";

  if (Object.keys(errores).length > 0 || !tipo) return { ok: false, errores };
  return { ok: true, valores: { tipo, montoCentavos, motivo } };
}

// ----------------------------------------------------------------- errores
export function mensajeDeErrorDeCaja(error: { code?: string; message?: string }): string {
  const detalle = error.message ?? "";
  if (detalle.includes("caja_ya_cerrada")) return "Esta caja ya fue cerrada.";
  if (detalle.includes("caja_cerrada")) return "No hay una caja abierta. Abrila primero.";
  if (error.code === "23505" && detalle.includes("un_solo_turno_abierto")) return "Ya hay una caja abierta.";
  if (error.code === "42501") return "No tenés permiso para esta operación.";
  if (detalle.includes("fetch failed")) {
    return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  return "No se pudo completar la operación. Intentá de nuevo.";
}

// ----------------------------------------------------------------- resumen
export type ResumenTurno = {
  turnoId: number;
  efectivoInicial: number;
  ventasCantidad: number;
  ventasTotal: number;
  descuentos: number;
  porMedio: Partial<Record<MedioPago, number>>;
  ingresosCaja: number;
  retirosCaja: number;
  gastosCaja: number;
  efectivoEsperado: number;
  /** null mientras la caja sigue abierta. */
  efectivoContado: number | null;
  /** contado − esperado: positivo = sobra, negativo = falta. null mientras sigue abierta. */
  diferencia: number | null;
};

const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const enteroONulo = (v: unknown): v is number | null => v === null || entero(v);

/**
 * La base devuelve el resumen como JSON "suelto". Antes de usarlo en pantalla lo verificamos
 * campo por campo; si algo no cuadra devolvemos null en vez de mostrar números dudosos.
 */
export function leerResumenTurno(json: unknown): ResumenTurno | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const j = json as Record<string, unknown>;

  const { turno_id, efectivo_inicial, ventas_cantidad, ventas_total, descuentos } = j;
  const { ingresos_caja, retiros_caja, gastos_caja, efectivo_esperado } = j;
  if (
    !entero(turno_id) || !entero(efectivo_inicial) || !entero(ventas_cantidad) || !entero(ventas_total) ||
    !entero(descuentos) || !entero(ingresos_caja) || !entero(retiros_caja) || !entero(gastos_caja) ||
    !entero(efectivo_esperado) || !enteroONulo(j.efectivo_contado) || !enteroONulo(j.diferencia)
  ) {
    return null;
  }

  const porMedio: Partial<Record<MedioPago, number>> = {};
  const crudoMedios = j.por_medio;
  if (typeof crudoMedios === "object" && crudoMedios !== null && !Array.isArray(crudoMedios)) {
    for (const { valor } of MEDIOS_DE_PAGO) {
      const monto = (crudoMedios as Record<string, unknown>)[valor];
      if (entero(monto)) porMedio[valor] = monto;
    }
  }

  return {
    turnoId: turno_id,
    efectivoInicial: efectivo_inicial,
    ventasCantidad: ventas_cantidad,
    ventasTotal: ventas_total,
    descuentos,
    porMedio,
    ingresosCaja: ingresos_caja,
    retirosCaja: retiros_caja,
    gastosCaja: gastos_caja,
    efectivoEsperado: efectivo_esperado,
    efectivoContado: j.efectivo_contado,
    diferencia: j.diferencia,
  };
}
