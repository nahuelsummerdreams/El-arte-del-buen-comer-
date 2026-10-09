import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioContrasena } from "./formulario-contrasena";

export default function PaginaContrasena() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <Link href="/" className="text-sm text-crema/60 hover:text-crema">
        ← Panel
      </Link>
      <h1 className="mb-2 mt-3 text-3xl font-semibold tracking-tight">Cambiar contraseña</h1>
      <p className="mb-8 text-sm text-crema/60">
        Elegí una que puedas recordar: una frase larga es mejor que una clave rara y corta.
      </p>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-white/5" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </main>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return <FormularioContrasena />;
}
