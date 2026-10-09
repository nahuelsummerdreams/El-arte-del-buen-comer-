import type { Proyeccion } from "@/lib/metas";
import { formatearPesos } from "@/lib/precios";

/**
 * Avance hacia la meta del mes. El estado se dice con palabras e ícono (el color es refuerzo, no el único aviso)
 * y las proyecciones se presentan como lo que son: una estimación.
 */
export function ProgresoMeta({ p }: { p: Proyeccion }) {
  if (p.estado === "sin_meta" || p.meta === null) {
    return <p data-meta="sin_meta" className="text-sm text-crema/65">Todavía no definiste una meta para este mes. Con una meta, el panel te dice si vas bien y cuánto te falta.</p>;
  }
  const avance = p.porcentajeAvance ?? 0;
  const mensajes = {
    cumplida: { icono: "✓", clase: "text-emerald-300", texto: "¡Meta cumplida! Todo lo que vendas ahora es de más." },
    va_bien: { icono: "▲", clase: "text-emerald-300", texto: `A este ritmo llegás: cerrarías el mes en ${formatearPesos(p.proyeccion ?? 0)}.` },
    atrasado: { icono: "▼", clase: "text-amber-300", texto: `A este ritmo cerrarías en ${formatearPesos(p.proyeccion ?? 0)}. Para llegar necesitás vender ${formatearPesos(p.necesarioPorDia ?? 0)} por día desde hoy.` },
    sin_datos: { icono: "○", clase: "text-crema/70", texto: "Todavía no hay un día completo de ventas para estimar el ritmo." },
  } as const;
  const m = mensajes[p.estado];

  return (
    <div data-meta={p.estado}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums">{formatearPesos(p.vendido)}</p>
        <p className="text-sm text-crema/60">de {formatearPesos(p.meta)}</p>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} aria-label="Avance hacia la meta del mes" className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="fx-llenar h-full rounded-full bg-miel" style={{ width: `${avance}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-crema/55">{avance} % de la meta · quedan {p.diasRestantes} {p.diasRestantes === 1 ? "día" : "días"} (hoy incluido)</p>
      <p className={`mt-3 flex items-start gap-2 text-sm ${m.clase}`}>
        <span aria-hidden>{m.icono}</span>
        <span>{m.texto}</span>
      </p>
      {!p.confiable && p.estado !== "cumplida" && p.estado !== "sin_datos" && (
        <p className="mt-1.5 text-xs text-crema/50">Es una estimación con pocos días de datos: se va afinando con las semanas.</p>
      )}
    </div>
  );
}
