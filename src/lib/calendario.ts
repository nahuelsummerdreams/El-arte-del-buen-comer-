/**
 * Calendario: cuadrícula del mes, navegación y feriados. Todo con fechas "AAAA-MM-DD" (días de
 * calendario, sin hora ni zona) y meses "AAAA-MM". Se calcula en UTC a mediodía para que ninguna
 * zona horaria corra un día.
 */

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS_SEMANA_CORTO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

const FORMATO_MES = /^(\d{4})-(\d{2})$/;
const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const dos = (n: number) => String(n).padStart(2, "0");

function partesMes(mes: string): { anio: number; mes: number } | null {
  const m = FORMATO_MES.exec(mes);
  if (!m) return null;
  const [anio, numero] = [Number(m[1]), Number(m[2])];
  return numero >= 1 && numero <= 12 && anio >= 1970 && anio <= 2200 ? { anio, mes: numero } : null;
}

function partesDia(dia: string): { anio: number; mes: number; dia: number } | null {
  const m = FORMATO_DIA.exec(dia);
  if (!m) return null;
  const [anio, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, d, 12));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d ? { anio, mes, dia: d } : null;
}

/** "2026-10-09" → "2026-10" */
export const mesDe = (dia: string): string => dia.slice(0, 7);

/** "2026-10" → "octubre de 2026" */
export function nombreDeMes(mes: string): string {
  const p = partesMes(mes);
  if (!p) throw new RangeError(`Mes inválido: «${mes}»`);
  return `${MESES[p.mes - 1]} de ${p.anio}`;
}

export function mesAnterior(mes: string): string {
  const p = partesMes(mes);
  if (!p) throw new RangeError(`Mes inválido: «${mes}»`);
  return p.mes === 1 ? `${p.anio - 1}-12` : `${p.anio}-${dos(p.mes - 1)}`;
}

export function mesSiguiente(mes: string): string {
  const p = partesMes(mes);
  if (!p) throw new RangeError(`Mes inválido: «${mes}»`);
  return p.mes === 12 ? `${p.anio + 1}-01` : `${p.anio}-${dos(p.mes + 1)}`;
}

/** Cuántos meses hay de `a` a `b` (positivo si b es posterior). */
export function mesesEntre(a: string, b: string): number {
  const x = partesMes(a);
  const y = partesMes(b);
  if (!x || !y) throw new RangeError("Mes inválido");
  return (y.anio - x.anio) * 12 + (y.mes - x.mes);
}

export const MAX_MESES_DE_DISTANCIA = 24;

/**
 * Mes que se muestra, a partir de lo que llega en la dirección (?mes=2026-09). Si falta, es raro o
 * está a más de 2 años de hoy, se muestra el mes de hoy: nadie puede pedir un mes absurdo.
 */
export function leerMes(parametro: unknown, hoy: string): string {
  const actual = mesDe(hoy);
  if (typeof parametro !== "string" || partesMes(parametro) === null) return actual;
  return Math.abs(mesesEntre(actual, parametro)) <= MAX_MESES_DE_DISTANCIA ? parametro : actual;
}

/** El día elegido (?dia=2026-10-09), solo si es una fecha real DENTRO del mes mostrado. */
export function leerDia(parametro: unknown, mes: string): string | null {
  if (typeof parametro !== "string" || partesDia(parametro) === null) return null;
  return mesDe(parametro) === mes ? parametro : null;
}

export function diasDelMes(mes: string): number {
  const p = partesMes(mes);
  if (!p) throw new RangeError(`Mes inválido: «${mes}»`);
  return new Date(Date.UTC(p.anio, p.mes, 0)).getUTCDate();
}

/** Primer y último día del mes. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  return { desde: `${mes}-01`, hasta: `${mes}-${dos(diasDelMes(mes))}` };
}

/** Día de la semana de una fecha: 0 = lunes … 6 = domingo (semana argentina). */
export function indiceDeSemana(dia: string): number {
  const p = partesDia(dia);
  if (!p) throw new RangeError(`Día inválido: «${dia}»`);
  return (new Date(Date.UTC(p.anio, p.mes - 1, p.dia, 12)).getUTCDay() + 6) % 7;
}

export type CeldaDia = { dia: string; delMes: boolean };

/** Semanas completas (lunes a domingo) que cubren el mes; los días de los meses vecinos van marcados. */
export function cuadriculaDelMes(mes: string): CeldaDia[][] {
  const p = partesMes(mes);
  if (!p) throw new RangeError(`Mes inválido: «${mes}»`);
  const primero = `${mes}-01`;
  const atras = indiceDeSemana(primero);
  const inicio = new Date(Date.UTC(p.anio, p.mes - 1, 1 - atras, 12));
  const total = Math.ceil((atras + diasDelMes(mes)) / 7) * 7;
  const celdas: CeldaDia[] = [];
  for (let i = 0; i < total; i++) {
    const f = new Date(inicio.getTime() + i * 86_400_000);
    const dia = `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
    celdas.push({ dia, delMes: mesDe(dia) === mes });
  }
  const semanas: CeldaDia[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

/**
 * Feriados nacionales de fecha FIJA. A propósito no están los que el Gobierno traslada o cambia cada
 * año (Carnaval, Semana Santa, Güemes, San Martín, Diversidad Cultural, Soberanía Nacional, puentes):
 * mejor no mostrar nada que mostrar un día equivocado.
 */
const FERIADOS_FIJOS: Record<string, string> = {
  "01-01": "Año Nuevo",
  "03-24": "Día de la Memoria",
  "04-02": "Día de Malvinas",
  "05-01": "Día del Trabajador",
  "05-25": "Revolución de Mayo",
  "06-20": "Día de la Bandera",
  "07-09": "Día de la Independencia",
  "12-08": "Inmaculada Concepción",
  "12-25": "Navidad",
};

export function feriadoDe(dia: string): string | null {
  if (partesDia(dia) === null) return null;
  return FERIADOS_FIJOS[dia.slice(5)] ?? null;
}

// --------------------------------------------------------------- reloj del inicio
export type Saludo = "Buen día" | "Buenas tardes" | "Buenas noches";

/** Saludo según la hora (0 a 23) en Argentina. */
export function saludoSegunHora(hora: number): Saludo {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw new RangeError(`Hora inválida: ${hora}`);
  if (hora >= 6 && hora < 13) return "Buen día";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
