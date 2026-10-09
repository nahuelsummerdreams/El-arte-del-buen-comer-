"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  leerResumenTurno,
  mensajeDeErrorDeCaja,
  validarApertura,
  validarCierre,
  validarMovimientoCaja,
} from "@/lib/caja";
import { obtenerSesion } from "@/lib/sesion";

/** Estado común de los tres formularios de Caja. */
export type EstadoCaja = {
  /** Cambia en cada respuesta; el formulario lo usa de `key` (React 19 reinicia los campos al terminar). */
  intento: number;
  errores: Partial<Record<string, string>>;
  mensaje: string | null;
  valores: Record<string, string>;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const campos = (fd: FormData, nombres: string[]) => Object.fromEntries(nombres.map((n) => [n, texto(fd.get(n))]));

export async function abrirCajaAccion(previo: EstadoCaja, formData: FormData): Promise<EstadoCaja> {
  const intento = previo.intento + 1;
  const valores = campos(formData, ["efectivoInicial"]);

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const r = validarApertura(valores);
  if (!r.ok) return { intento, errores: r.errores, mensaje: null, valores };

  const { error } = await sesion.supabase
    .from("turnos_caja")
    .insert({ abierto_por: sesion.user.id, efectivo_inicial_centavos: r.valores.efectivoInicial });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorDeCaja(error), valores };

  revalidatePath("/caja");
  redirect("/caja?abierta=1");
}

export async function registrarMovimientoAccion(previo: EstadoCaja, formData: FormData): Promise<EstadoCaja> {
  const intento = previo.intento + 1;
  const valores = campos(formData, ["tipo", "monto", "motivo"]);

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const r = validarMovimientoCaja(valores);
  if (!r.ok) return { intento, errores: r.errores, mensaje: null, valores };

  const { error } = await sesion.supabase.rpc("registrar_movimiento_caja", {
    p_tipo: r.valores.tipo,
    p_monto_centavos: r.valores.montoCentavos,
    p_motivo: r.valores.motivo,
  });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorDeCaja(error), valores };

  revalidatePath("/caja");
  redirect("/caja?mov=1");
}

export async function cerrarCajaAccion(previo: EstadoCaja, formData: FormData): Promise<EstadoCaja> {
  const intento = previo.intento + 1;
  const valores = campos(formData, ["efectivoContado", "nota"]);

  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const r = validarCierre(valores);
  if (!r.ok) return { intento, errores: r.errores, mensaje: null, valores };

  // El turno a cerrar lo decide el servidor (el único abierto), no el navegador.
  const { data: turno } = await sesion.supabase.from("turnos_caja").select("id").is("cerrado_en", null).maybeSingle();
  if (!turno) return { intento, errores: {}, mensaje: "Esta caja ya fue cerrada.", valores };

  const { data, error } = await sesion.supabase.rpc("cerrar_caja", {
    p_turno_id: turno.id,
    p_efectivo_contado_centavos: r.valores.efectivoContado,
    p_nota: r.valores.nota ?? "",
  });
  if (error) return { intento, errores: {}, mensaje: mensajeDeErrorDeCaja(error), valores };
  // Verificamos que la base devolvió un resumen coherente antes de dar el cierre por bueno.
  if (!leerResumenTurno(data)) return { intento, errores: {}, mensaje: "La caja se cerró, pero no pudimos leer el resumen. Revisalo en Caja.", valores };

  revalidatePath("/caja");
  redirect("/caja?cierre=1");
}
