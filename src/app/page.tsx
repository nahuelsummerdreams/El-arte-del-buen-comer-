import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BotonCerrarSesion } from "./boton-cerrar-sesion";
import { obtenerSesion } from "@/lib/sesion";

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
      <nav aria-label="Secciones" className="flex flex-col items-center gap-4">
        <Link
          href="/venta"
          className="rounded-lg bg-crema px-8 py-3 text-base font-semibold text-tinta shadow-lg shadow-black/30 transition hover:bg-crema/90"
        >
          Vender
        </Link>
        <Link
          href="/productos"
          className="rounded-lg border border-crema/30 px-5 py-2.5 text-sm font-medium transition hover:bg-white/5"
        >
          Productos
        </Link>
        <Link
          href="/caja"
          className="rounded-lg border border-crema/30 px-5 py-2.5 text-sm font-medium transition hover:bg-white/5"
        >
          Caja
        </Link>
        <Link href="/cuenta/contrasena" className="text-sm text-crema/60 underline-offset-4 transition hover:text-crema hover:underline">
          Cambiar contraseña
        </Link>
      </nav>
      <BotonCerrarSesion />
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
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { perfil } = sesion;

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">Hola, {perfil.nombre}</h1>
      <p className="text-crema/60">
        {perfil.rol === "dueno" ? "Dueño" : "Cajero"} · Productos · Ventas · Inventario · Caja
      </p>
    </div>
  );
}
