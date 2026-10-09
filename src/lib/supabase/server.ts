import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Lee las variables de entorno y falla con un mensaje claro si faltan.
 * (Sin esto, el error sería un críptico "Invalid URL" más adelante.)
 */
export function leerEntornoSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copiá .env.example a .env.local y completalos.",
    );
  }
  return { url, key };
}

/**
 * Cliente de Supabase para Server Components y Server Actions.
 *
 * Se crea UNO NUEVO en cada pedido (no se reutiliza), porque la sesión
 * vive en las cookies de ese pedido en particular.
 */
export async function crearClienteServidor() {
  const { url, key } = leerEntornoSupabase();
  const cookieStore = await cookies(); // en esta versión de Next, cookies() es async

  // <Database>: con esto TypeScript conoce tus tablas y columnas reales y marca los errores de tipeo.
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies. Está bien:
          // el proxy ya se encarga de refrescar la sesión en cada pedido.
        }
      },
    },
  });
}
