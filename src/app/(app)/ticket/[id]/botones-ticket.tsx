"use client";

import Link from "next/link";
import { Icono } from "@/components/icono";

/** Imprimir (la impresora o «Guardar como PDF») y mandar por WhatsApp. "use client" solo para abrir el diálogo de impresión. */
export function BotonesTicket({ enlaceWhatsApp }: { enlaceWhatsApp: string }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg border border-crema/25 px-4 py-2.5 text-sm font-medium transition hover:bg-white/5";
  return (
    <div className="no-imprimir mt-5 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => window.print()} data-imprimir className={base}>
        <Icono nombre="ticket" className="h-4 w-4" /> Imprimir o guardar PDF
      </button>
      <a href={enlaceWhatsApp} target="_blank" rel="noopener noreferrer" data-whatsapp className={base}>
        <Icono nombre="enviar" className="h-4 w-4" /> Mandar por WhatsApp
      </a>
      <Link href="/venta" className="rounded-lg bg-crema px-4 py-2.5 text-center text-sm font-medium text-tinta shadow-md shadow-black/20 transition hover:bg-crema/90 sm:col-span-2">Nueva venta</Link>
    </div>
  );
}
