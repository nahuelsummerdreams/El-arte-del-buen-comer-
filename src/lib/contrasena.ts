export const CONTRASENA_MIN = 10;
/** bcrypt (el cifrado que usa Supabase) solo considera los primeros 72 bytes: más largo no suma. */
export const CONTRASENA_MAX = 72;

export type CampoContrasena = "actual" | "nueva" | "repetir";
export type ErroresContrasena = Partial<Record<CampoContrasena, string>>;
export type ResultadoContrasena =
  | { ok: true; valores: { actual: string; nueva: string } }
  | { ok: false; errores: ErroresContrasena };

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Valida el formulario de "Cambiar contraseña".
 *
 * - NO recorta espacios: son parte de la contraseña (una frase con espacios es válida).
 * - Los mensajes jamás incluyen lo que la persona escribió.
 * - Reglas a propósito simples: largo mínimo, no solo números, no un carácter repetido.
 *   Una frase larga vale más que una clave "rara" corta.
 */
export function validarContrasenaNueva(entrada: Record<string, unknown>): ResultadoContrasena {
  const errores: ErroresContrasena = {};
  const actual = texto(entrada.actual);
  const nueva = texto(entrada.nueva);
  const repetir = texto(entrada.repetir);

  if (actual === "") errores.actual = "Escribí tu contraseña actual.";

  if (nueva.length < CONTRASENA_MIN) {
    errores.nueva = `La nueva contraseña debe tener al menos ${CONTRASENA_MIN} caracteres.`;
  } else if (nueva.length > CONTRASENA_MAX) {
    errores.nueva = `La nueva contraseña admite hasta ${CONTRASENA_MAX} caracteres.`;
  } else if (/^\d+$/.test(nueva)) {
    errores.nueva = "No uses solo números: agregá letras (una frase fácil de recordar sirve).";
  } else if (new Set(nueva).size === 1) {
    errores.nueva = "No uses un solo carácter repetido.";
  } else if (actual !== "" && nueva === actual) {
    errores.nueva = "La nueva contraseña tiene que ser distinta de la actual.";
  }

  if (repetir === "") {
    errores.repetir = "Repetí la nueva contraseña.";
  } else if (repetir !== nueva) {
    errores.repetir = "Las contraseñas no coinciden.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valores: { actual, nueva } };
}
