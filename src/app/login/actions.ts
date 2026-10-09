"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { COOKIE_ULTIMO_EMAIL } from "./cookies";
import { mensajeDeErrorDeLogin } from "./mensajes";

export type EstadoLogin = {
  error: string | null;
  /** El email escrito, para no hacerlo escribir de nuevo después de un error. */
  email: string;
  /** Cambia en cada respuesta; el formulario lo usa de `key` (React 19 reinicia los campos al terminar la acción). */
  intento: number;
};

export async function iniciarSesion(
  estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const intento = estadoPrevio.intento + 1;
  // FormData.get devuelve string | File | null: nos aseguramos de que sea texto.
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return {
      error: "Completá el email y la contraseña.",
      email: typeof email === "string" ? email : "",
      intento,
    };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    // El texto depende del TIPO de error: así una caída de red no se confunde con una clave mala.
    return { error: mensajeDeErrorDeLogin(error ?? {}), email: email.trim(), intento };
  }

  // Tener cuenta no alcanza: hace falta un perfil activo (es lo que habilitan las reglas RLS).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("id", data.user.id)
    .eq("activo", true)
    .maybeSingle();

  if (!perfil) {
    await supabase.auth.signOut();
    return { error: "Tu usuario no tiene acceso al sistema. Consultá con el dueño.", email: email.trim(), intento };
  }

  // Recordamos el email (solo el email, nunca la contraseña) para ofrecerlo la próxima vez.
  // httpOnly: lo lee el servidor al dibujar el login; ningún script del navegador puede tocarlo.
  (await cookies()).set(COOKIE_ULTIMO_EMAIL, email.trim(), {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/"); // redirect() corta la ejecución; va fuera de try/catch a propósito
}

/** Cierra la sesión. La redirección la hace el navegador (ver BotonCerrarSesion): una recarga completa. */
export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
}
