/** Lo mínimo que usamos de un error de Supabase Auth (así es fácil de probar). */
export type ErrorDeAuth = {
  code?: string;
  status?: number;
  name?: string;
};

const GENERICO = "No se pudo iniciar sesión. Intentá de nuevo.";

/**
 * Traduce un error de Supabase Auth a un mensaje para la persona.
 *
 * Regla de oro: solo decimos "contraseña incorrecta" cuando Supabase lo confirmó
 * (invalid_credentials). Una caída de red o del servidor NO debe hacer que el cajero
 * dude de su contraseña.
 */
export function mensajeDeErrorDeLogin(error: ErrorDeAuth): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos."; // genérico a propósito: no revela si el email existe
    case "email_not_confirmed":
      return "Tu email todavía no fue confirmado.";
    case "over_request_rate_limit":
      return "Demasiados intentos. Esperá un momento e intentá de nuevo.";
  }

  // status 0 / AuthRetryableFetchError: la petición ni llegó al servidor (sin conexión, DNS, etc.).
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  }
  if (error.status !== undefined && error.status >= 500) {
    return "El servidor tuvo un problema. Intentá de nuevo en un momento.";
  }
  return GENERICO;
}
