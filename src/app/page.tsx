import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { cerrarSesion } from "./login/actions";
import { crearClienteServidor } from "@/lib/supabase/server";

// Con Cache Components, la página es una "carcasa" estática que carga al instante
// (logo, botón). Lo que depende de la sesión se completa en cada pedido, dentro de <Suspense>.
export default function Panel() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Image
        src="/logo.jpg"
        alt="Logo de El Arte del Buen Comer"
        width={754}
        height={765}
        priority
        className="h-40 w-40 rounded-full object-cover shadow-2xl shadow-black/60"
      />
      <Suspense fallback={<SaludoCargando />}>
        <Saludo />
      </Suspense>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

function SaludoCargando() {
  // Misma altura que el saludo real, para que la página no "salte" al cargar.
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="mx-auto h-9 w-56 animate-pulse rounded bg-white/10" />
      <div className="mx-auto h-6 w-72 animate-pulse rounded bg-white/5" />
    </div>
  );
}

async function Saludo() {
  const supabase = await crearClienteServidor();

  // Verificamos la identidad acá también, no solo en el proxy (defensa en profundidad).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) redirect("/login");

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">Hola, {perfil.nombre}</h1>
      <p className="text-crema/60">
        {perfil.rol === "dueno" ? "Dueño" : "Cajero"} · Productos · Ventas · Inventario · Caja
      </p>
    </div>
  );
}
