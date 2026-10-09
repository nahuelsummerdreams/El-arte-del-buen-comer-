"use server";

import { redirect } from "next/navigation";
import { validarContrasenaNueva, type ErroresContrasena } from "@/lib/contrasena";
import { obtenerSesion } from "@/lib/sesion";
import { mensajeDeErrorDeLogin } from "@/app/login/mensajes";

/**
 * A propósito el estado NO contiene ninguna contraseña: lo escrito nunca vuelve al navegador.
 */
export type EstadoContrasena = {
  errores: ErroresContrasena;
  mensaje: string | null;
  exito: boolean;
};

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function cambiarContrasenaAccion(
  _estadoPrevio: EstadoContrasena,
  formData: FormData,
): Promise<EstadoContrasena> {
  // 1) Quién es (dentro de la acción: es una puerta pública).
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const email = sesion.user.email;
  if (!email) return { errores: {}, mensaje: "Tu usuario no tiene un correo asociado.", exito: false };

  // 2) Validación en el servidor.
  const resultado = validarContrasenaNueva({
    actual: texto(formData.get("actual")),
    nueva: texto(formData.get("nueva")),
    repetir: texto(formData.get("repetir")),
  });
  if (!resultado.ok) return { errores: resultado.errores, mensaje: null, exito: false };
  const { actual, nueva } = resultado.valores;

  // 3) Comprobamos la contraseña ACTUAL volviendo a iniciar sesión. Así, quien encuentre una
  //    compu desbloqueada no puede apropiarse de la cuenta cambiándole la clave.
  const { error: errorActual } = await sesion.supabase.auth.signInWithPassword({ email, password: actual });
  if (errorActual) {
    if (errorActual.code === "invalid_credentials") {
      return { errores: { actual: "La contraseña actual no es correcta." }, mensaje: null, exito: false };
    }
    return { errores: {}, mensaje: mensajeDeErrorDeLogin(errorActual), exito: false };
  }

  // 4) Cambio.
  const { error } = await sesion.supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === "same_password") {
      return { errores: { nueva: "La nueva contraseña tiene que ser distinta de la actual." }, mensaje: null, exito: false };
    }
    if (error.code === "weak_password") {
      return { errores: { nueva: "Contraseña demasiado débil. Probá con una frase más larga." }, mensaje: null, exito: false };
    }
    return { errores: {}, mensaje: "No se pudo cambiar la contraseña. Intentá de nuevo.", exito: false };
  }

  return { errores: {}, mensaje: null, exito: true };
}
