import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * El "guardia de la puerta": corre ANTES de cada página.
 *  - Sin sesión  -> te manda a /login
 *  - Con sesión y entrando a /login -> te manda al panel
 * Además refresca la sesión (los tokens vencen) y actualiza las cookies.
 *
 * Importante: esto es comodidad, NO la seguridad real. La seguridad real
 * son las reglas RLS de la base de datos y las verificaciones dentro de
 * cada Server Action.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return new NextResponse(
      "Configuración incompleta: faltan las variables de Supabase (.env.local).",
      { status: 500 },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cabeceras anti-caché: que ningún CDN reparta la sesión de una persona a otra.
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getUser() le pregunta a Supabase si el token es válido. No usar getSession() acá.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !enLogin) return redirigir(request, "/login", response);
  if (user && enLogin) return redirigir(request, "/", response);

  return response;
}

/** Redirige conservando las cookies de sesión que pudieron haberse refrescado. */
function redirigir(request: NextRequest, destino: string, base: NextResponse) {
  const redireccion = NextResponse.redirect(new URL(destino, request.url));
  base.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
  base.headers.forEach((valor, nombre) => {
    if (nombre === "cache-control" || nombre === "expires" || nombre === "pragma") {
      redireccion.headers.set(nombre, valor);
    }
  });
  return redireccion;
}

export const config = {
  // Todas las rutas, MENOS archivos estáticos e imágenes (si no, el logo no cargaría en /login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
