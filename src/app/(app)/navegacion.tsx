import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { Asistente } from "./_asistente/asistente";
import { NavegacionCliente } from "./navegacion-cliente";

/** Lee quién está usando el sistema (nombre y rol) para armar el menú. */
export async function Navegacion() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return (
    <>
      <NavegacionCliente nombre={sesion.perfil.nombre} rol={sesion.perfil.rol} />
      <Asistente rol={sesion.perfil.rol} nombre={sesion.perfil.nombre} />
    </>
  );
}

/** Mientras llega la sesión: un hueco del mismo tamaño para que la pantalla no "salte". */
export function NavegacionCargando() {
  return (
    <>
      <div aria-hidden className="hidden w-64 shrink-0 border-r border-crema/10 bg-black/20 lg:block" />
      <div aria-hidden className="h-[5.6rem] border-b border-crema/10 lg:hidden" />
    </>
  );
}
