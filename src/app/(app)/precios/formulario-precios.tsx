"use client";

import { useActionState, useState } from "react";
import { formatearPesos } from "@/lib/precios";
import { armarCambios, leerPorcentaje, REDONDEOS, type ProductoConPrecio, type RedondeoPesos } from "@/lib/precios-masivos";
import { aplicarPreciosAccion, type EstadoPrecios } from "./actions";

const campo = "w-full rounded-lg border border-crema/20 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60";

/**
 * "use client" para la VISTA PREVIA en vivo. Es solo una guía: al confirmar, el servidor vuelve a leer
 * los precios de la base y rehace las cuentas por su cuenta.
 */
export function FormularioPrecios({ productos, categorias }: { productos: ProductoConPrecio[]; categorias: { id: number; nombre: string }[] }) {
  const [estado, accion, enviando] = useActionState<EstadoPrecios, FormData>(aplicarPreciosAccion, { intento: 0, mensaje: null });
  const [porcentaje, setPorcentaje] = useState("");
  const [redondeo, setRedondeo] = useState<RedondeoPesos>(10);
  const [categoria, setCategoria] = useState("");

  const leido = porcentaje.trim() === "" ? null : leerPorcentaje(porcentaje);
  const vista = leido?.ok
    ? armarCambios(productos, { categoriaId: categoria === "" ? null : Number(categoria), puntosBasicos: leido.puntosBasicos, redondeo })
    : null;

  return (
    <form action={accion} noValidate className="space-y-6">
      {estado.mensaje && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{estado.mensaje}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="porcentaje" className="text-sm">Aumento (%)</label>
          <input id="porcentaje" name="porcentaje" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej.: 8 o 8,5 o -3" aria-invalid={leido?.ok === false} className={campo} />
          {leido?.ok === false && <p data-error="porcentaje" className="text-sm text-red-300">{leido.error}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoriaId" className="text-sm">A qué productos</label>
          <select id="categoriaId" name="categoriaId" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="redondeo" className="text-sm">Redondear</label>
          <select id="redondeo" name="redondeo" value={redondeo} onChange={(e) => setRedondeo(Number(e.target.value) as RedondeoPesos)} className={campo}>
            {REDONDEOS.map((r) => <option key={r.pesos} value={r.pesos}>{r.etiqueta}</option>)}
          </select>
        </div>
      </div>

      {vista && (
        <section aria-label="Vista previa" data-vista-previa className="rounded-2xl border border-crema/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-medium">Así quedarían los precios</h2>
          <p className="mb-3 text-sm text-crema/60">
            {vista.cambios.length} {vista.cambios.length === 1 ? "precio cambia" : "precios cambian"}
            {vista.sinCambio > 0 && ` · ${vista.sinCambio} se queda${vista.sinCambio === 1 ? "" : "n"} igual`}
          </p>
          {vista.cambios.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-crema/50"><tr><th className="pb-2 text-left font-normal">Producto</th><th className="pb-2 text-right font-normal">Antes</th><th className="pb-2 text-right font-normal">Después</th></tr></thead>
                <tbody className="divide-y divide-crema/10">
                  {vista.cambios.map((c) => (
                    <tr key={c.id} data-cambio={c.id}>
                      <td className="py-2 pr-2">{c.nombre}</td>
                      <td className="py-2 pl-4 text-right tabular-nums text-crema/60">{formatearPesos(c.anterior)}</td>
                      <td className="py-2 pl-4 text-right tabular-nums font-medium">{formatearPesos(c.nuevo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vista.fueraDeRango.length > 0 && <p role="alert" className="mt-3 text-sm text-red-300">No entra en el sistema: {vista.fueraDeRango.join(", ")}.</p>}
        </section>
      )}

      <button type="submit" disabled={enviando || !vista || vista.cambios.length === 0 || vista.fueraDeRango.length > 0} className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-50">
        {enviando ? "Aplicando…" : vista && vista.cambios.length > 0 ? `Aplicar a ${vista.cambios.length} ${vista.cambios.length === 1 ? "producto" : "productos"}` : "Aplicar precios"}
      </button>
      <p className="text-sm text-crema/50">Los precios anteriores quedan guardados en el historial. Las ventas ya hechas no cambian.</p>
    </form>
  );
}
