/**
 * Cookie que recuerda el último email usado EN ESE DISPOSITIVO (nunca la contraseña).
 * Vive en su propio archivo porque un archivo "use server" solo puede exportar funciones async.
 */
export const COOKIE_ULTIMO_EMAIL = "ultimo_email";
