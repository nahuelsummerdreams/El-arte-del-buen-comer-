"use client";

import { useState } from "react";
import { abreviarPesos, escalaLimpia, escalarBarras, etiquetaDiaCorta, etiquetaDiaLarga, type DiaVenta } from "@/lib/panel";
import { formatearPesos } from "@/lib/precios";

const ALTO = 220; // px del área de barras

/**
 * Ventas por día (una sola serie → un solo color). Cada barra es su propio blanco para el mouse
 * y el dedo: al pasar o tocar se levanta y muestra el detalle. Debajo hay una vista de tabla con
 * los mismos números, para quien no pueda usar el gráfico.
 *
 * "use client" solo porque el detalle depende de qué barra está activa.
 */
export function GraficoVentas({ dias }: { dias: DiaVenta[] }) {
  const [activo, setActivo] = useState<number | null>(null);

  const totales = dias.map((d) => d.total);
  const escala = escalaLimpia(Math.max(0, ...totales));
  // Alturas relativas al tope del eje (no al máximo de los datos): así las marcas y las barras coinciden.
  const alturas = escalarBarras([...totales, escala.max], 100).slice(0, -1);
  const sinVentas = totales.every((t) => t === 0);
  const n = dias.length;
  const salto = n <= 7 ? 1 : n <= 14 ? 2 : 5;
  const d = activo !== null ? dias[activo] : null;
  const centro = activo !== null ? ((activo + 0.5) / n) * 100 : 50;

  return (
    <div>
      <div className="flex pt-3">
        {/* eje vertical */}
        <div aria-hidden className="relative w-[4.5rem] shrink-0" style={{ height: ALTO }}>
          {escala.ticks.map((t, i) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[0.7rem] text-crema/50 tabular-nums" style={{ bottom: `${(i / 4) * 100}%` }}>
              {t === 0 ? "$ 0" : abreviarPesos(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: ALTO }}>
          {/* líneas guía: finas, sólidas y apagadas */}
          {escala.ticks.map((t, i) => (
            <span key={t} aria-hidden className={`absolute inset-x-0 border-t ${i === 0 ? "border-crema/25" : "border-crema/10"}`} style={{ bottom: `${(i / 4) * 100}%` }} />
          ))}

          <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {dias.map((x, i) => (
              <button
                key={x.dia}
                type="button"
                data-dia={x.dia}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActivo(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                onClick={() => setActivo(i)}
                aria-label={`${etiquetaDiaLarga(x.dia)}: ${formatearPesos(x.total)} en ${x.cantidad} ${x.cantidad === 1 ? "venta" : "ventas"}`}
                className="group flex h-full items-end justify-center px-[2px] outline-none"
              >
                <span
                  style={{ height: `${alturas[i]}%`, "--i": i } as React.CSSProperties}
                  className={`fx-barra block w-full max-w-6 rounded-t-[4px] transition-colors ${activo === i ? "bg-[#d08a4b]" : "bg-miel"} ${activo !== null && activo !== i ? "opacity-70" : ""}`}
                />
              </button>
            ))}
          </div>

          {sinVentas && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm text-crema/55">
              Todavía no hay ventas en este período.
            </p>
          )}

          {d && (
            <div
              role="status"
              data-tooltip
              className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-xl border border-crema/15 bg-tinta px-3 py-2 shadow-xl shadow-black/50"
              style={{ left: `${Math.min(86, Math.max(14, centro))}%`, top: 4 }}
            >
              <p className="text-lg font-semibold tabular-nums">{formatearPesos(d.total)}</p>
              <p className="flex items-center gap-1.5 text-xs text-crema/65">
                <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-miel" />
                {d.cantidad} {d.cantidad === 1 ? "venta" : "ventas"}
              </p>
              <p className="mt-0.5 text-xs text-crema/55">{etiquetaDiaLarga(d.dia)}</p>
            </div>
          )}
        </div>
      </div>

      {/* eje horizontal: no todas las etiquetas entran, así que se espacian */}
      <div className="ml-14 mt-2 grid text-center text-[0.7rem] text-crema/55" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {dias.map((x, i) => {
          const esHoy = i === n - 1;
          const visible = esHoy || (i % salto === 0 && n - 1 - i >= salto);
          return (
            <span key={x.dia} className={esHoy ? "font-semibold text-crema" : ""}>
              {visible ? (esHoy ? "hoy" : etiquetaDiaCorta(x.dia)) : ""}
            </span>
          );
        })}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-crema/60 hover:text-crema">Ver como tabla</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-crema/50">
            <tr>
              <th className="py-1 font-normal">Día</th>
              <th className="py-1 text-right font-normal">Ventas</th>
              <th className="py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((x) => (
              <tr key={x.dia} className="border-t border-crema/10">
                <td className="py-1.5">{etiquetaDiaLarga(x.dia)}</td>
                <td className="py-1.5 text-right tabular-nums">{x.cantidad}</td>
                <td className="py-1.5 text-right tabular-nums">{formatearPesos(x.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
