import { MEDIOS_DE_PAGO } from "@/lib/caja";
import type { MedioVendido } from "@/lib/panel";
import { formatearPesos } from "@/lib/precios";

/**
 * Cobrado por medio de pago. Las categorías no tienen un orden natural, así que TODAS las barras
 * llevan el mismo color y quien las distingue es el texto (el color no codifica nada acá).
 * La pista de cada barra es un tono más claro de la misma miel.
 */
export function BarrasMedios({ medios }: { medios: MedioVendido[] }) {
  const total = medios.reduce((suma, m) => suma + m.total, 0);
  const filas = MEDIOS_DE_PAGO.map((m) => {
    const dato = medios.find((x) => x.medio === m.valor);
    const monto = dato?.total ?? 0;
    return { ...m, monto, pct: total > 0 ? (monto / total) * 100 : 0 };
  }).sort((a, b) => b.monto - a.monto);

  return (
    <div>
      <p data-total-medios className="text-3xl font-semibold tracking-tight tabular-nums">{formatearPesos(total)}</p>
      <p className="text-xs text-crema/55">cobrado en el período</p>
      <ul className="mt-5 space-y-4">
        {filas.map((f) => (
          <li key={f.valor} data-medio={f.valor}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-crema/85">{f.etiqueta}</span>
              <span className="tabular-nums">
                {formatearPesos(f.monto)} <span className="text-crema/50">· {Math.round(f.pct)} %</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-miel/20" role="presentation">
              <div className="h-full rounded-full bg-miel" style={{ width: `${f.pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
