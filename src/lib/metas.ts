import { pesosACentavos } from "@/lib/precios";

/**
 * Meta del mes, proyección y punto de equilibrio. Todo en centavos, con fechas "AAAA-MM-DD".
 * Regla de la casa: si no hay datos suficientes, se dice; no se inventa una proyección.
 */

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(hoy: string): { anio: number; mes: number; dia: number } {
  const m = FORMATO.exec(hoy);
  if (!m) throw new RangeError(`Día inválido: «${hoy}»`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new RangeError(`Día inválido: «${hoy}»`);
  }
  return { anio, mes, dia };
}

/** "2026-10-09" → 31 (cuántos días tiene ese mes; contempla años bisiestos). */
export function diasDelMes(hoy: string): number {
  const { anio, mes } = partes(hoy);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** "2026-10-09" → "2026-10-01". La meta de cada mes se guarda con el día 1. */
export function primerDiaDelMes(hoy: string): string {
  const { anio, mes } = partes(hoy);
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/** "2026-10-09" → 9 (cuántos días van del mes, hoy incluido). */
export function diaDelMes(hoy: string): number {
  return partes(hoy).dia;
}

export type EstadoMeta = "sin_meta" | "sin_datos" | "cumplida" | "va_bien" | "atrasado";

export type Proyeccion = {
  estado: EstadoMeta;
  meta: number | null;
  vendido: number;
  /** Cuánto falta para la meta (0 si ya se cumplió). null si no hay meta. */
  faltante: number | null;
  /** Días que quedan, hoy incluido. */
  diasRestantes: number;
  /** Cuánto habría que vender por día, desde hoy, para llegar. null si no hay meta o ya se cumplió. */
  necesarioPorDia: number | null;
  /** Ritmo diario según los días completos del mes (hoy no cuenta: todavía no terminó). null si no hay ningún día completo. */
  ritmoDiario: number | null;
  /** A este ritmo, cuánto se vendería en el mes. null si no hay ritmo. */
  proyeccion: number | null;
  /** La proyección se apoya en al menos una semana de datos. Antes de eso es solo una pista. */
  confiable: boolean;
  porcentajeAvance: number | null;
};

/**
 * `ventasDelMes`: lo vendido cada día, del día 1 hasta hoy inclusive (el último es hoy, aún en curso).
 */
export function proyectarMes(hoy: string, ventasDelMes: readonly number[], meta: number | null): Proyeccion {
  const dia = diaDelMes(hoy);
  if (ventasDelMes.length !== dia) throw new RangeError(`Se esperaban ${dia} días de ventas y llegaron ${ventasDelMes.length}`);
  const total = diasDelMes(hoy);
  const completos = ventasDelMes.slice(0, -1);
  const vendido = ventasDelMes.reduce((s, v) => s + v, 0);
  const diasRestantes = total - dia + 1;

  const ritmoDiario = completos.length > 0 ? Math.round(completos.reduce((s, v) => s + v, 0) / completos.length) : null;
  const proyeccion = ritmoDiario === null ? null : ritmoDiario * total;
  const confiable = completos.length >= 7;

  const faltante = meta === null ? null : Math.max(0, meta - vendido);
  const necesarioPorDia = faltante === null || faltante === 0 ? null : Math.ceil(faltante / diasRestantes);

  let estado: EstadoMeta;
  if (meta === null) estado = "sin_meta";
  else if (vendido >= meta) estado = "cumplida";
  else if (proyeccion === null) estado = "sin_datos";
  else estado = proyeccion >= meta ? "va_bien" : "atrasado";

  return {
    estado,
    meta,
    vendido,
    faltante,
    diasRestantes,
    necesarioPorDia,
    ritmoDiario,
    proyeccion,
    confiable,
    porcentajeAvance: meta === null ? null : Math.min(100, Math.floor((vendido / meta) * 100)),
  };
}

export type PuntoDeEquilibrio = { ventasMensuales: number; ventasPorDia: number };

/**
 * Cuánto hay que vender para cubrir los gastos fijos, dado el margen que deja lo que se vende.
 * Con margen cero o negativo (o desconocido) no existe: devuelve null en vez de un número absurdo.
 */
export function puntoDeEquilibrio(gastosFijosMensuales: number, margenPct: number | null, diasMes: number): PuntoDeEquilibrio | null {
  if (margenPct === null || !(margenPct > 0) || !(gastosFijosMensuales >= 0) || !(diasMes > 0)) return null;
  const ventasMensuales = Math.ceil((gastosFijosMensuales * 100) / margenPct);
  return { ventasMensuales, ventasPorDia: Math.ceil(ventasMensuales / diasMes) };
}

// ----------------------------------------------------------------- formularios
export type ResultadoMonto = { ok: true; centavos: number } | { ok: false; error: string };

/** Meta o gasto escrito en pesos ("1.200.000" o "1200000,50"). Debe ser mayor a cero salvo que se permita cero. */
export function validarMonto(texto: string, { permitirCero = false }: { permitirCero?: boolean } = {}): ResultadoMonto {
  if (texto.trim() === "") return { ok: false, error: "Escribí el monto." };
  let centavos: number;
  try {
    centavos = pesosACentavos(texto);
  } catch {
    return { ok: false, error: "Monto inválido. Escribilo en pesos, por ejemplo 1200000 o 1.200.000,50" };
  }
  if (centavos === 0 && !permitirCero) return { ok: false, error: "El monto debe ser mayor a cero." };
  return { ok: true, centavos };
}

export function validarNombre(texto: string, etiqueta: string, max = 60): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = texto.trim().replace(/\s+/g, " ");
  if (nombre === "") return { ok: false, error: `Escribí ${etiqueta}.` };
  if (nombre.length > max) return { ok: false, error: `Máximo ${max} caracteres.` };
  return { ok: true, nombre };
}

const TELEFONO = /^[\d\s()+\-]{6,25}$/;
/** Teléfono opcional: solo números, espacios, + - y paréntesis. */
export function validarTelefono(texto: string): { ok: true; telefono: string | null } | { ok: false; error: string } {
  const t = texto.trim();
  if (t === "") return { ok: true, telefono: null };
  return TELEFONO.test(t) ? { ok: true, telefono: t } : { ok: false, error: "Teléfono inválido. Usá solo números, espacios y + - ( )." };
}
