/**
 * Fechas SIEMPRE en hora de Argentina.
 *
 * Los servidores (Vercel, Supabase) trabajan en UTC, 3 horas adelantados: una venta a las 23:59
 * del 9 de octubre "ya es" 10 de octubre para ellos. Si no fijamos la zona, los reportes
 * diarios mandarían las ventas de la noche al día equivocado.
 */
const ZONA = "America/Argentina/Buenos_Aires";

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const soloHora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
// "en-CA" escribe las fechas como AAAA-MM-DD, que además se puede ordenar como texto.
const soloDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

function aFecha(valor: string | Date): Date {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new RangeError(`Fecha inválida: «${String(valor)}»`);
  return fecha;
}

/** "2026-10-09T19:47:29Z" → "09/10/2026 16:47" */
export const formatearFechaHora = (v: string | Date) => fechaHora.format(aFecha(v)).replace(",", "");
/** → "16:47" */
export const formatearHora = (v: string | Date) => soloHora.format(aFecha(v));
/** El día calendario en Argentina, como "AAAA-MM-DD". */
export const diaArgentina = (v: string | Date) => soloDia.format(aFecha(v));
