"use client";

import { Icono } from "@/components/icono";
import { cerrarSesion } from "@/app/login/actions";

/**
 * Cierra la sesión y hace una recarga COMPLETA hacia /login.
 *
 * Por qué no un redirect normal del servidor: Next.js conserva en memoria las pantallas ya
 * visitadas para volver rápido. Tras cerrar sesión eso podría dejar a la vista datos de la
 * persona anterior (compu compartida del local) y mostrar el login "viejo" sin el email
 * recordado. Una navegación completa vacía todo lo que el navegador tenía en memoria.
 */
export function BotonCerrarSesion({ className, etiquetaCorta = false }: { className?: string; etiquetaCorta?: boolean }) {
  async function salir() {
    await cerrarSesion();
    // Excepción a propósito a la regla de Next: acá SÍ queremos una recarga completa (ver arriba).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <form action={salir}>
      <button type="submit" className={className ?? "rounded-lg border border-crema/30 px-4 py-2 text-sm transition hover:bg-white/5"}>
        <Icono nombre="salir" className="h-4 w-4" />
        {etiquetaCorta ? "Salir" : "Cerrar sesión"}
      </button>
    </form>
  );
}
