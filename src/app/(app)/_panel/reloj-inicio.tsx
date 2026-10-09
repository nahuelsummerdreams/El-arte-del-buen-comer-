"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icono } from "@/components/icono";
import { feriadoDe, saludoSegunHora } from "@/lib/calendario";
import { diaArgentina, formatearHora } from "@/lib/fechas";
import { etiquetaDiaLarga } from "@/lib/panel";

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * El día, la fecha y la hora de HOY (hora de Argentina), con el saludo que corresponde.
 * "use client" porque la hora se va actualizando sola. El servidor manda la hora inicial para que
 * la pantalla salga completa desde el primer momento (sin parpadeo).
 */
export function RelojInicio({ ahoraInicial }: { ahoraInicial: string }) {
  const [ahora, setAhora] = useState(() => new Date(ahoraInicial));

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const dia = diaArgentina(ahora);
  const hora = formatearHora(ahora);
  const feriado = feriadoDe(dia);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-crema/70" data-reloj>
      <Link href="/calendario" className="inline-flex items-center gap-2 rounded-full border border-crema/15 bg-white/5 px-3 py-1.5 transition hover:border-miel hover:bg-miel/10" title="Abrir el calendario">
        <Icono nombre="calendario" className="h-4 w-4 text-miel" />
        <span data-fecha className="font-medium text-crema">{mayuscula(etiquetaDiaLarga(dia))} de {dia.slice(0, 4)}</span>
      </Link>
      <span data-hora className="inline-flex items-center gap-1.5 tabular-nums">
        <Icono nombre="reloj" className="h-4 w-4 text-miel" />
        {hora}
      </span>
      <span data-saludo className="text-crema/55">{saludoSegunHora(Number(hora.slice(0, 2)))}</span>
      {feriado && <span data-feriado className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">Hoy es feriado: {feriado}</span>}
    </div>
  );
}
