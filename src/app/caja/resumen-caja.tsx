import { MEDIOS_DE_PAGO, type ResumenTurno } from "@/lib/caja";
import { formatearPesos } from "@/lib/precios";

function Tarjeta({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle?: string; tono?: "ok" | "aviso" | "error" }) {
  const color =
    tono === "ok" ? "text-emerald-300" : tono === "aviso" ? "text-amber-300" : tono === "error" ? "text-red-300" : "text-crema";
  return (
    <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-crema/50">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-sm text-crema/60">{detalle}</p>}
    </div>
  );
}

/** Resumen de un turno de caja. Solo muestra datos: no tiene estado ni formularios. */
export function ResumenCaja({ resumen }: { resumen: ResumenTurno }) {
  const { efectivoContado: contado, diferencia: dif } = resumen;
  // Hay "contado" y "diferencia" solo cuando la caja ya se cerró.
  const cerrado = contado !== null && dif !== null;

  return (
    <div className="flex flex-col gap-3" data-resumen="caja">
      <div className="grid grid-cols-2 gap-3">
        <Tarjeta
          titulo="Ventas"
          valor={formatearPesos(resumen.ventasTotal)}
          detalle={`${resumen.ventasCantidad} ${resumen.ventasCantidad === 1 ? "venta" : "ventas"}${resumen.descuentos > 0 ? ` · descuentos ${formatearPesos(resumen.descuentos)}` : ""}`}
        />
        <Tarjeta
          titulo="Efectivo esperado"
          valor={formatearPesos(resumen.efectivoEsperado)}
          detalle={`Apertura ${formatearPesos(resumen.efectivoInicial)}`}
        />
      </div>

      {cerrado && (
        <div className="grid grid-cols-2 gap-3">
          <Tarjeta titulo="Efectivo contado" valor={formatearPesos(contado)} />
          <Tarjeta
            titulo="Diferencia"
            valor={formatearPesos(dif)}
            tono={dif === 0 ? "ok" : dif > 0 ? "aviso" : "error"}
            detalle={dif === 0 ? "Caja cuadrada" : dif > 0 ? "Sobra efectivo" : "Falta efectivo"}
          />
        </div>
      )}

      <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-crema/50">Cobrado por medio de pago</p>
        <ul className="divide-y divide-crema/10">
          {MEDIOS_DE_PAGO.map((m) => (
            <li key={m.valor} className="flex justify-between py-1.5 text-sm">
              <span className="text-crema/80">{m.etiqueta}</span>
              <span className="tabular-nums">{formatearPesos(resumen.porMedio[m.valor] ?? 0)}</span>
            </li>
          ))}
        </ul>
        {(resumen.retirosCaja > 0 || resumen.gastosCaja > 0 || resumen.ingresosCaja > 0) && (
          <ul className="mt-3 divide-y divide-crema/10 border-t border-crema/10 pt-2 text-sm">
            {resumen.ingresosCaja > 0 && (
              <li className="flex justify-between py-1.5"><span className="text-crema/80">Ingresos de efectivo</span><span className="tabular-nums">+ {formatearPesos(resumen.ingresosCaja)}</span></li>
            )}
            {resumen.retirosCaja > 0 && (
              <li className="flex justify-between py-1.5"><span className="text-crema/80">Retiros</span><span className="tabular-nums">− {formatearPesos(resumen.retirosCaja)}</span></li>
            )}
            {resumen.gastosCaja > 0 && (
              <li className="flex justify-between py-1.5"><span className="text-crema/80">Gastos</span><span className="tabular-nums">− {formatearPesos(resumen.gastosCaja)}</span></li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
