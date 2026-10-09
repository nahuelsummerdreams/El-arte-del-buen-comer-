"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeDeErrorDeLogin } from "./mensajes";

export type EstadoLogin = { error: string | null };

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  // FormData.get devuelve string | File | null: nos aseguramos de que sea texto.
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Completá el email y la contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    // El texto depende del TIPO de error: así una caída de red no se confunde con una clave mala.
    return { error: mensajeDeErrorDeLogin(error ?? {}) };
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
    return { error: "Tu usuario no tiene acceso al sistema. Consultá con el dueño." };
  }

  redirect("/"); // redirect() corta la ejecución; va fuera de try/catch a propósito
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
