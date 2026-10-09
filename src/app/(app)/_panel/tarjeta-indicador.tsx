import { Icono, type NombreIcono } from "@/components/icono";
import { variacionPorcentual } from "@/lib/panel";
import { escalarBarras } from "@/lib/panel";

/** Mini-gráfico de barras: los días anteriores en tono apagado y el último (hoy) resaltado. */
function Sparkline({ valores }: { valores: number[] }) {
  const alturas = escalarBarras(valores, 100);
  return (
    <div aria-hidden className="flex h-9 items-end gap-[3px]">
      {alturas.map((h, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(h, 6)}%` }}
          className={`w-[4px] rounded-t-[2px] ${i === alturas.length - 1 ? "bg-miel" : "bg-crema/20"}`}
        />
      ))}
    </div>
  );
}

/**
 * Chip de variación contra el período anterior. El color NUNCA va solo: lleva flecha y texto
 * (hay quien no distingue verde de rojo). Si no hay período anterior con ventas, no se muestra.
 */
function ChipVariacion({ actual, anterior, contra }: { actual: number; anterior: number; contra: string }) {
  const v = variacionPorcentual(actual, anterior);
  if (v === null) return null;
  const sube = v > 0;
  const baja = v < 0;
  const color = sube ? "bg-emerald-400/10 text-emerald-300" : baja ? "bg-red-400/10 text-red-300" : "bg-white/5 text-crema/70";
  const texto = sube ? `subió ${v} %` : baja ? `bajó ${Math.abs(v)} %` : "igual";
  return (
    <span
      title={`${texto} respecto de ${contra}`}
      aria-label={`${texto} respecto de ${contra}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${color}`}
    >
      <span aria-hidden>{sube ? "▲" : baja ? "▼" : "＝"}</span>
      {Math.abs(v)} %
    </span>
  );
}

export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  icono,
  grande = false,
  comparar,
  serie,
  acento,
  indice = 0,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  icono: NombreIcono;
  /** La cifra principal de la pantalla (una sola por vista). */
  grande?: boolean;
  comparar?: { actual: number; anterior: number; contra: string };
  serie?: number[];
  /** Resalta la tarjeta (por ejemplo, algo que requiere atención). */
  acento?: "atencion";
  /** Orden de aparición (0, 1, 2…): las tarjetas entran una tras otra. */
  indice?: number;
}) {
  return (
    <div
      style={{ "--i": indice } as React.CSSProperties}
      className={`fx-entra fx-tarjeta rounded-2xl border p-4 ${acento === "atencion" ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-crema/10 bg-white/[0.04]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-crema/10 text-crema">
          <Icono nombre={icono} />
        </span>
        {comparar && <ChipVariacion {...comparar} />}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-crema/65">{etiqueta}</p>
          <p data-kpi={etiqueta} className={`${grande ? "text-4xl xl:text-5xl" : "text-2xl"} mt-0.5 font-semibold tracking-tight tabular-nums`}>
            {valor}
          </p>
          {detalle && <p className="mt-1 text-xs text-crema/55">{detalle}</p>}
        </div>
        {serie && serie.length > 1 && <Sparkline valores={serie} />}
      </div>
    </div>
  );
}
