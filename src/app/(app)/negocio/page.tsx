import { redirect } from "next/navigation";
import { Suspense } from "react";
import { calcularGanancia, leerResumenGanancia } from "@/lib/costos";
import { diaArgentina } from "@/lib/fechas";
import { diaDelMes, diasDelMes, primerDiaDelMes, proyectarMes, puntoDeEquilibrio } from "@/lib/metas";
import { leerVentasPorDia, restarDias } from "@/lib/panel";
import { centavosATextoEditable, formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { ProgresoMeta } from "../_panel/progreso-meta";
import { Fallo, Seccion } from "../_panel/vista-panel";
import { quitarGastoAccion } from "./actions";
import { FormularioGasto, FormularioMeta } from "./formularios";

export default function PaginaNegocio() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Metas y gastos</h1>
      <p className="mb-8 mt-2 text-sm text-crema/60">Cuánto querés vender este mes, cuánto vas, y cuánto tenés que vender solo para cubrir los gastos fijos.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido />
      </Suspense>
    </main>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== "dueno") redirect("/");
  const { supabase } = sesion;

  const hoy = diaArgentina(new Date());
  const mes = primerDiaDelMes(hoy);
  const [ventasRes, metaRes, gastosRes, gananciaRes] = await Promise.all([
    supabase.rpc("ventas_por_dia", { p_dias: diaDelMes(hoy) }),
    supabase.from("metas_mensuales").select("meta_centavos").eq("mes", mes).maybeSingle(),
    supabase.from("gastos_fijos").select("id, nombre, monto_centavos").eq("activo", true).order("id"),
    supabase.rpc("resumen_ganancia", { p_desde: restarDias(hoy, 29), p_hasta: hoy }),
  ]);
  const ventas = leerVentasPorDia(ventasRes.data);
  const gananciaFila = leerResumenGanancia(gananciaRes.data);
  if (ventasRes.error || metaRes.error || gastosRes.error || gananciaRes.error || !ventas || !gananciaFila || ventas.length !== diaDelMes(hoy)) {
    return <Fallo texto="No pudimos cargar los datos. Intentá de nuevo en un momento." />;
  }

  const meta = metaRes.data?.meta_centavos ?? null;
  const proyeccion = proyectarMes(hoy, ventas.map((v) => v.total), meta);
  const totalGastos = gastosRes.data.reduce((s, g) => s + g.monto_centavos, 0);
  const g = calcularGanancia(gananciaFila);
  const equilibrio = puntoDeEquilibrio(totalGastos, g.margenPct, diasDelMes(hoy));

  return (
    <div className="space-y-6">
      <Seccion titulo="Meta del mes" subtitulo="Una meta por mes. Podés cambiarla cuando quieras.">
        <div className="space-y-6">
          <ProgresoMeta p={proyeccion} />
          <FormularioMeta actual={meta ? centavosATextoEditable(meta) : ""} />
        </div>
      </Seccion>

      <Seccion titulo="Gastos fijos del mes" subtitulo="Alquiler, luz, sueldos, impuestos… lo que pagás aunque no vendas.">
        {gastosRes.data.length > 0 && (
          <ul className="mb-5 divide-y divide-crema/10">
            {gastosRes.data.map((x) => (
              <li key={x.id} data-gasto={x.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>{x.nombre}</span>
                <span className="flex items-center gap-4">
                  <span className="tabular-nums">{formatearPesos(x.monto_centavos)}</span>
                  <form action={quitarGastoAccion}>
                    <input type="hidden" name="gastoId" value={x.id} />
                    <button type="submit" aria-label={`Quitar ${x.nombre}`} className="rounded-lg border border-crema/20 px-2.5 py-1 text-xs text-crema/70 transition hover:bg-white/5">Quitar</button>
                  </form>
                </span>
              </li>
            ))}
            <li className="flex justify-between py-2.5 font-medium"><span>Total por mes</span><span data-total-gastos className="tabular-nums">{formatearPesos(totalGastos)}</span></li>
          </ul>
        )}
        <FormularioGasto />
      </Seccion>

      <Seccion titulo="Punto de equilibrio" subtitulo="Cuánto hay que vender para no perder plata.">
        {totalGastos === 0 ? (
          <p className="text-sm text-crema/65">Cargá tus gastos fijos para calcularlo.</p>
        ) : equilibrio === null ? (
          <p data-equilibrio="no" className="text-sm text-crema/65">
            Todavía no se puede calcular: hace falta saber cuánto ganás sobre lo que vendés, y eso sale de los costos que cargás al ingresar mercadería.
            {g.coberturaPct !== null && ` Hoy el ${g.coberturaPct} % de lo vendido en los últimos 30 días tiene costo cargado.`}
          </p>
        ) : (
          <div data-equilibrio="si">
            <p className="text-3xl font-semibold tabular-nums">{formatearPesos(equilibrio.ventasMensuales)}</p>
            <p className="text-sm text-crema/60">por mes · unos {formatearPesos(equilibrio.ventasPorDia)} por día</p>
            <p className="mt-3 text-sm text-crema/65">
              Calculado con tus gastos fijos ({formatearPesos(totalGastos)}) y un margen de {g.margenPct} % sobre lo vendido en los últimos 30 días
              {g.coberturaPct !== null && g.coberturaPct < 100 ? `, con costo cargado en el ${g.coberturaPct} % de las ventas` : ""}. Es una guía, no una promesa.
            </p>
          </div>
        )}
      </Seccion>
    </div>
  );
}
