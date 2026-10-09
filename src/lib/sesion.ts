import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Quién está usando el sistema, o null si no hay una sesión válida con perfil activo.
 *
 * Es el ÚNICO lugar donde las páginas y las Server Actions se enteran de quién es el usuario
 * y qué rol tiene. Así la regla "sin perfil activo no se entra" no se repite (ni se olvida).
 * Devuelve también el cliente de Supabase ya autenticado, para reutilizarlo en la consulta.
 */
export async function obtenerSesion() {
  const supabase = await crearClienteServidor();

  // getUser() valida el token con Supabase (getSession() no es confiable en el servidor).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .eq("activo", true)
    .maybeSingle();
  if (!perfil) return null;

  return { supabase, user, perfil };
}
