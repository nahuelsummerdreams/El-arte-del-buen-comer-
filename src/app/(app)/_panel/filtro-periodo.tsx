import Link from "next/link";

const OPCIONES = [7, 14, 30] as const;
export type Periodo = (typeof OPCIONES)[number];

/** "?dias=14" → 14. Cualquier otra cosa vuelve al valor por defecto (30). */
export function leerPeriodo(valor: string | string[] | undefined): Periodo {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return OPCIONES.find((o) => o === n) ?? 30;
}

/** Un solo filtro, arriba, que acota todo lo que está debajo (gráfico, medios de pago, más vendidos). */
export function FiltroPeriodo({ actual }: { actual: Periodo }) {
  return (
    <div role="group" aria-label="Período" className="inline-flex rounded-full border border-crema/15 bg-white/[0.03] p-1">
      {OPCIONES.map((o) => (
        <Link
          key={o}
          href={o === 30 ? "/" : `/?dias=${o}`}
          scroll={false}
          aria-current={actual === o ? "true" : undefined}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${actual === o ? "bg-crema font-medium text-tinta" : "text-crema/70 hover:text-crema"}`}
        >
          {o} días
        </Link>
      ))}
    </div>
  );
}
