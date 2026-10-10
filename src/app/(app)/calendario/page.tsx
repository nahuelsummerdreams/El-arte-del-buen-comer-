import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icono } from "@/components/icono";
import { cuadriculaDelMes, DIAS_SEMANA_CORTO, feriadoDe, leerDia, leerMes, mesAnterior, mesSiguiente, mesDe, nombreDeMes, rangoDelMes } from "@/lib/calendario";
import { estadoDeuda, leerDeudas, leerVencimientos, textoVencimiento, type FilaDeuda, type FilaVencimiento } from "@/lib/costos";
import { diaArgentina, formatearHora } from "@/lib/fechas";
import { abreviarPesos, etiquetaDiaLarga, leerVentasPorDia, restarDias, ticketPromedio, type DiaVenta } from "@/lib/panel";
import { formatearPesos, formatearStock } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { Fallo, Seccion } from "../_panel/vista-panel";

export default function PaginaCalendario(props: PageProps<"/calendario">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Calendario</h1>
      <p className="mb-6 mt-2 text-sm text-crema/60">Tus ventas día por día, lo que vence y lo que hay que pagar.</p>
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function Contenido({ searchParams }: { searchParams: PageProps<"/calendario">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase, perfil } = sesion;
  const esDueno = perfil.rol === "dueno";
  const q = await searchParams;

  const hoy = diaArgentina(new Date());
  const mes = leerMes(q.mes, hoy);
  const elegido = leerDia(q.dia, mes) ?? (mesDe(hoy) === mes ? hoy : null);
  const { desde, hasta } = rangoDelMes(mes);

  const [ventasRes, vencRes, deudasRes, productosRes, proveedoresRes] = await Promise.all([
    supabase.rpc("ventas_por_dia", { p_dias: 366 }),
    esDueno ? supabase.rpc("vencimientos_proximos", { p_dias: 365 }) : Promise.resolve({ data: [], error: null }),
    esDueno
      ? supabase.from("lotes_stock").select("id, producto_id, proveedor_id, costo_total_centavos, pagar_hasta").eq("pagado", false).gte("pagar_hasta", desde).lte("pagar_hasta", hasta)
      : Promise.resolve({ data: [], error: null }),
    esDueno ? supabase.from("productos").select("id, nombre") : Promise.resolve({ data: [], error: null }),
    esDueno ? supabase.from("proveedores").select("id, nombre") : Promise.resolve({ data: [], error: null }),
  ]);

  const ventas = ventasRes.error ? null : leerVentasPorDia(ventasRes.data);
  if (!ventas) return <Fallo texto="No pudimos cargar el calendario. Intentá de nuevo en un momento." />;
  const vencimientos = vencRes.error ? null : leerVencimientos(vencRes.data);
  const deudas = deudasRes.error ? null : leerDeudas(deudasRes.data);

  const ventaDe = new Map<string, DiaVenta>(ventas.map((v) => [v.dia, v]));
  const vencenEl = new Map<string, FilaVencimiento[]>();
  for (const v of vencimientos ?? []) vencenEl.set(v.vence_el, [...(vencenEl.get(v.vence_el) ?? []), v]);
  const pagosEl = new Map<string, FilaDeuda[]>();
  for (const d of deudas ?? []) if (d.pagar_hasta) pagosEl.set(d.pagar_hasta, [...(pagosEl.get(d.pagar_hasta) ?? []), d]);
  const nombreProducto = new Map<number, string>((productosRes.data ?? []).map((p: { id: number; nombre: string }) => [p.id, p.nombre]));
  const nombreProveedor = new Map<number, string>((proveedoresRes.data ?? []).map((p: { id: number; nombre: string }) => [p.id, p.nombre]));

  // Las ventas del día elegido, una por una, para abrir su comprobante. El día argentino va de las 00:00 a las 24:00 (UTC−3).
  const ventasDelDia = elegido
    ? await supabase
        .from("ventas")
        .select("id, total_centavos, creado_en")
        .eq("estado", "completada")
        .gte("creado_en", `${elegido}T00:00:00-03:00`)
        .lt("creado_en", `${restarDias(elegido, -1)}T00:00:00-03:00`)
        .order("creado_en", { ascending: false })
        .limit(60)
    : null;

  const semanas = cuadriculaDelMes(mes);
  const maximo = Math.max(0, ...semanas.flat().filter((c) => c.delMes).map((c) => ventaDe.get(c.dia)?.total ?? 0));
  const totalMes = semanas.flat().filter((c) => c.delMes).reduce((s, c) => s + (ventaDe.get(c.dia)?.total ?? 0), 0);
  const ventasMes = semanas.flat().filter((c) => c.delMes).reduce((s, c) => s + (ventaDe.get(c.dia)?.cantidad ?? 0), 0);
  const enlace = (m: string, d?: string) => `/calendario?mes=${m}${d ? `&dia=${d}` : ""}`;

  const vd = elegido ? ventaDe.get(elegido) : undefined;
  const venceElegido = elegido ? (vencenEl.get(elegido) ?? []) : [];
  const pagaElegido = elegido ? (pagosEl.get(elegido) ?? []) : [];
  const feriadoElegido = elegido ? feriadoDe(elegido) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={enlace(mesAnterior(mes))} aria-label="Mes anterior" className="grid h-10 w-10 place-items-center rounded-xl border border-crema/20 text-lg transition hover:bg-white/5">‹</Link>
          <h2 data-mes className="min-w-[11rem] text-center font-display text-2xl">{mayuscula(nombreDeMes(mes))}</h2>
          <Link href={enlace(mesSiguiente(mes))} aria-label="Mes siguiente" className="grid h-10 w-10 place-items-center rounded-xl border border-crema/20 text-lg transition hover:bg-white/5">›</Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-crema/65">{ventasMes === 0 ? "Sin ventas este mes" : <>Este mes: <strong className="text-crema">{formatearPesos(totalMes)}</strong> en {ventasMes} {ventasMes === 1 ? "venta" : "ventas"}</>}</span>
          {mes !== mesDe(hoy) && <Link href={enlace(mesDe(hoy), hoy)} className="rounded-lg border border-crema/25 px-3 py-1.5 transition hover:bg-white/5">Ir a hoy</Link>}
        </div>
      </div>

      <div className="fx-entra overflow-hidden rounded-2xl border border-crema/10 bg-white/[0.04] p-2 sm:p-3" data-calendario>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[0.7rem] uppercase tracking-wider text-crema/50 sm:text-xs">
          {DIAS_SEMANA_CORTO.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {semanas.flat().map((c, i) => {
            const v = ventaDe.get(c.dia);
            const vence = vencenEl.get(c.dia)?.length ?? 0;
            const paga = pagosEl.get(c.dia)?.length ?? 0;
            const feriado = feriadoDe(c.dia);
            const esHoy = c.dia === hoy;
            const esElegido = c.dia === elegido;
            const intensidad = v && v.total > 0 && maximo > 0 ? Math.round(12 + (v.total / maximo) * 40) : 0;
            const descripcion = [
              mayuscula(etiquetaDiaLarga(c.dia)),
              v && v.cantidad > 0 ? `${formatearPesos(v.total)} en ${v.cantidad} ventas` : null,
              vence > 0 ? `${vence} vencimientos` : null,
              paga > 0 ? `${paga} pagos a proveedores` : null,
              feriado ? `feriado: ${feriado}` : null,
              esHoy ? "hoy" : null,
            ].filter(Boolean).join(", ");
            return (
              <Link
                key={c.dia}
                href={enlace(mes, c.dia)}
                aria-label={descripcion}
                aria-current={esHoy ? "date" : undefined}
                data-dia={c.dia}
                data-tiene-ventas={v && v.cantidad > 0 ? "si" : "no"}
                style={{ "--i": Math.min(i, 20), ...(intensidad > 0 ? { backgroundColor: `color-mix(in oklab, var(--color-miel) ${intensidad}%, transparent)` } : {}) } as React.CSSProperties}
                className={`fx-entra relative flex min-h-[3.6rem] flex-col justify-between rounded-lg border p-1.5 text-left transition hover:border-miel sm:min-h-[5.2rem] sm:p-2 ${c.delMes ? "" : "opacity-35"} ${esElegido ? "border-crema ring-1 ring-crema" : esHoy ? "border-miel" : "border-crema/10"}`}
              >
                <span className="flex items-start justify-between">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-sm tabular-nums ${esHoy ? "bg-miel font-semibold text-white" : ""}`}>{Number(c.dia.slice(8))}</span>
                  {feriado && <span title={feriado} className="text-[0.6rem] font-semibold uppercase text-amber-300">feriado</span>}
                </span>
                <span className="flex items-end justify-between gap-1">
                  <span className="hidden text-[0.7rem] font-medium tabular-nums sm:block">{v && v.total > 0 ? abreviarPesos(v.total) : ""}</span>
                  <span className="flex items-center gap-1 text-[0.65rem]" aria-hidden>
                    {vence > 0 && <span className="inline-flex items-center gap-0.5 text-amber-300"><Icono nombre="reloj" className="h-3 w-3" />{vence}</span>}
                    {paga > 0 && <span className="inline-flex items-center gap-0.5 text-red-300"><Icono nombre="ganancia" className="h-3 w-3" />{paga}</span>}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <p className="px-1 pt-3 text-xs text-crema/55">
          Más oscuro = más ventas. {esDueno && <><Icono nombre="reloj" className="inline h-3 w-3 text-amber-300" /> vencimiento · <Icono nombre="ganancia" className="inline h-3 w-3 text-red-300" /> pago a proveedor · </>}Feriados nacionales de fecha fija (los trasladables no figuran).
        </p>
      </div>

      {elegido && (
        <Seccion titulo={mayuscula(etiquetaDiaLarga(elegido))} subtitulo={elegido === hoy ? "Hoy" : `${elegido.slice(0, 4)}`} indice={1}>
          <div data-detalle-dia={elegido} className="space-y-5 text-sm">
            {feriadoElegido && <p className="inline-block rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">Feriado: {feriadoElegido}</p>}

            <div>
              <h3 className="mb-1 font-medium">Ventas</h3>
              {vd && vd.cantidad > 0 ? (
                <p data-ventas-dia className="text-crema/80">
                  <strong className="text-lg text-crema">{formatearPesos(vd.total)}</strong> en {vd.cantidad} {vd.cantidad === 1 ? "venta" : "ventas"} · ticket promedio {formatearPesos(ticketPromedio(vd.total, vd.cantidad))}
                  {vd.descuentos > 0 ? ` · descuentos ${formatearPesos(vd.descuentos)}` : ""}
                </p>
              ) : (
                <p className="text-crema/60">{elegido > hoy ? "Todavía no llegó este día." : ventas.some((x) => x.dia === elegido) ? "No hubo ventas." : "Sin datos de ventas para este día."}</p>
              )}
            </div>

            {ventasDelDia && !ventasDelDia.error && ventasDelDia.data.length > 0 && (
              <div>
                <h3 className="mb-1 font-medium">Comprobantes</h3>
                <ul className="divide-y divide-crema/10" data-ventas-del-dia>
                  {ventasDelDia.data.map((v) => (
                    <li key={v.id}>
                      <Link href={`/ticket/${v.id}`} className="flex justify-between gap-3 py-2 transition hover:text-miel">
                        <span>N.º {v.id} <span className="text-crema/55">· {formatearHora(v.creado_en)}</span></span>
                        <span className="tabular-nums">{formatearPesos(v.total_centavos)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {esDueno && (
              <>
                <div>
                  <h3 className="mb-1 font-medium">Vencimientos</h3>
                  {venceElegido.length === 0 ? <p className="text-crema/60">No vence nada este día.</p> : (
                    <ul className="divide-y divide-crema/10">
                      {venceElegido.map((x) => (
                        <li key={x.lote_id} className="flex justify-between gap-3 py-2"><span>{x.nombre} <span className="text-crema/55">· quedan unos {formatearStock(x.quedan, x.tipo_venta)}</span></span><span className="text-amber-300">{textoVencimiento(x.dias_restantes)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-1 font-medium">Pagos a proveedores</h3>
                  {pagaElegido.length === 0 ? <p className="text-crema/60">No hay pagos este día.</p> : (
                    <ul className="divide-y divide-crema/10">
                      {pagaElegido.map((x) => (
                        <li key={x.id} className="flex justify-between gap-3 py-2">
                          <span>{x.proveedor_id !== null ? (nombreProveedor.get(x.proveedor_id) ?? "Proveedor") : "Sin proveedor"} <span className="text-crema/55">· {nombreProducto.get(x.producto_id) ?? "producto"}</span></span>
                          <span className="tabular-nums">{formatearPesos(x.costo_total_centavos)} <span className="text-crema/55">· {estadoDeuda(x.pagar_hasta, hoy).texto}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/proveedores" className="mt-2 inline-block text-xs underline underline-offset-4">Ver cuentas a pagar</Link>
                </div>
              </>
            )}
          </div>
        </Seccion>
      )}
    </div>
  );
}
