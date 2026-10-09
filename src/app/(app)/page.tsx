import { redirect } from "next/navigation";
import { Suspense } from "react";
import { leerResumenTurno } from "@/lib/caja";
import { calcularGanancia, estadoDeuda, leerDeudas, leerResumenGanancia, leerVencimientos } from "@/lib/costos";
import { diaArgentina, formatearHora } from "@/lib/fechas";
import { diaDelMes, primerDiaDelMes, proyectarMes } from "@/lib/metas";
import { leerMasVendidos, leerVentasPorDia, leerVentasPorMedio, productosParaReponer, restarDias } from "@/lib/panel";
import { formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { leerPeriodo, type Periodo } from "./_panel/filtro-periodo";
import { TarjetaIndicador } from "./_panel/tarjeta-indicador";
import { Encabezado, Fallo, VistaPanelDueno } from "./_panel/vista-panel";

type Supabase = NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>["supabase"];

// Con Cache Components la página es una carcasa que carga al instante; todo lo que depende de la
// sesión y de los datos llega dentro de <Suspense>.
export default function Panel(props: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <Suspense fallback={<PanelCargando />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function PanelCargando() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="h-16 w-72 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase, perfil } = sesion;
  const q = await searchParams;

  return perfil.rol === "dueno" ? (
    <PanelDueno supabase={supabase} nombre={perfil.nombre} periodo={leerPeriodo(q.dias)} />
  ) : (
    <PanelCajero supabase={supabase} nombre={perfil.nombre} />
  );
}

// =============================================================================== DUEÑO
// Esta función SOLO carga y valida los datos; dibujarlos es trabajo de VistaPanelDueno.
async function PanelDueno({ supabase, nombre, periodo }: { supabase: Supabase; nombre: string; periodo: Periodo }) {
  const hoy = diaArgentina(new Date());
  const desde = restarDias(hoy, periodo - 1);

  const [serieRes, mediosRes, masRes, productosRes, stocksRes, turnoRes, gananciaRes, vencRes, deudasRes, metaRes, proveedoresRes] = await Promise.all([
    supabase.rpc("ventas_por_dia", { p_dias: 31 }), // 31 = el mes más largo: alcanza para el gráfico y para el avance del mes
    supabase.rpc("ventas_por_medio", { p_desde: desde, p_hasta: hoy }),
    supabase.rpc("productos_mas_vendidos", { p_desde: desde, p_hasta: hoy, p_limite: 8 }),
    supabase.from("productos_con_precio").select("id, nombre, tipo_venta, stock_minimo").eq("activo", true),
    supabase.from("stock_actual").select("producto_id, stock"),
    supabase.from("turnos_caja").select("id, abierto_en").is("cerrado_en", null).maybeSingle(),
    supabase.rpc("resumen_ganancia", { p_desde: desde, p_hasta: hoy }),
    supabase.rpc("vencimientos_proximos", { p_dias: 7 }),
    supabase.from("lotes_stock").select("id, producto_id, proveedor_id, costo_total_centavos, pagar_hasta").eq("pagado", false).order("pagar_hasta", { ascending: true, nullsFirst: false }),
    supabase.from("metas_mensuales").select("meta_centavos").eq("mes", primerDiaDelMes(hoy)).maybeSingle(),
    supabase.from("proveedores").select("id, nombre"),
  ]);

  // Todo lo que viene de la base se verifica antes de mostrarse: si algo no cuadra, avisamos en vez de inventar cifras.
  const serie = leerVentasPorDia(serieRes.data);
  const medios = leerVentasPorMedio(mediosRes.data);
  const masVendidos = leerMasVendidos(masRes.data);
  if (
    serieRes.error || mediosRes.error || masRes.error || productosRes.error || stocksRes.error || turnoRes.error ||
    !serie || serie.length < 2 || !medios || !masVendidos
  ) {
    return (
      <div className="space-y-6">
        <Encabezado nombre={nombre} hoy={hoy} cajaAbiertaDesde={null} />
        <Fallo texto="No pudimos cargar los números del panel. Intentá de nuevo en un momento." />
      </div>
    );
  }

  const turno = turnoRes.data;
  const resumenCaja = turno ? leerResumenTurno((await supabase.rpc("resumen_turno", { p_turno_id: turno.id })).data) : null;

  const stockDe = new Map(stocksRes.data.map((s) => [s.producto_id, s.stock ?? 0]));
  const paraReponer = productosParaReponer(
    productosRes.data.flatMap((p) =>
      p.id !== null && p.nombre !== null && p.tipo_venta !== null
        ? [{ id: p.id, nombre: p.nombre, tipoVenta: p.tipo_venta, stock: stockDe.get(p.id) ?? 0, stockMinimo: p.stock_minimo ?? 0 }]
        : [],
    ),
    1000,
  );

  // Los bloques nuevos (ganancia, meta, vencimientos, deudas) se degradan solos: si uno falla, el resto del panel sigue.
  const filaGanancia = gananciaRes.error ? null : leerResumenGanancia(gananciaRes.data);
  const vencimientos = vencRes.error ? null : leerVencimientos(vencRes.data);
  const deudasLeidas = deudasRes.error ? null : leerDeudas(deudasRes.data);

  const delMes = serie.slice(-diaDelMes(hoy)).map((d) => d.total);
  const meta = metaRes.error || delMes.length !== diaDelMes(hoy) ? null : proyectarMes(hoy, delMes, metaRes.data?.meta_centavos ?? null);

  const nombreProducto = new Map(productosRes.data.flatMap((p) => (p.id !== null && p.nombre !== null ? [[p.id, p.nombre] as const] : [])));
  const nombreProveedor = new Map((proveedoresRes.data ?? []).map((p) => [p.id, p.nombre] as const));
  const deudas = deudasLeidas
    ? {
        total: deudasLeidas.reduce((t, x) => t + x.costo_total_centavos, 0),
        lista: deudasLeidas.map((x) => ({
          id: x.id,
          producto: nombreProducto.get(x.producto_id) ?? "Producto",
          proveedor: x.proveedor_id !== null ? (nombreProveedor.get(x.proveedor_id) ?? null) : null,
          monto: x.costo_total_centavos,
          estado: estadoDeuda(x.pagar_hasta, hoy),
        })),
      }
    : null;

  return (
    <VistaPanelDueno
      ganancia={filaGanancia ? calcularGanancia(filaGanancia) : null}
      meta={meta}
      vencimientos={vencimientos}
      deudas={deudas}
      nombre={nombre}
      hoy={hoy}
      periodo={periodo}
      serie={serie}
      medios={medios}
      masVendidos={masVendidos}
      paraReponer={paraReponer}
      cajaAbiertaDesde={turno?.abierto_en ?? null}
      efectivoEnCaja={resumenCaja ? resumenCaja.efectivoEsperado : null}
    />
  );
}

// =============================================================================== CAJERO
async function PanelCajero({ supabase, nombre }: { supabase: Supabase; nombre: string }) {
  const hoy = diaArgentina(new Date());
  const [ventasRes, turnoRes] = await Promise.all([
    supabase.rpc("ventas_por_dia", { p_dias: 1 }), // el cajero solo ve SUS ventas (permisos de la base)
    supabase.from("turnos_caja").select("id, abierto_en").is("cerrado_en", null).maybeSingle(),
  ]);
  const mias = leerVentasPorDia(ventasRes.data)?.[0] ?? null;
  const turno = turnoRes.data;

  return (
    <div className="space-y-6">
      <Encabezado nombre={nombre} hoy={hoy} cajaAbiertaDesde={turno?.abierto_en ?? null} />
      {ventasRes.error || !mias ? (
        <Fallo texto="No pudimos cargar tus ventas de hoy. Intentá de nuevo en un momento." />
      ) : (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <TarjetaIndicador
            grande
            icono="tendencia"
            etiqueta="Tus ventas de hoy"
            valor={formatearPesos(mias.total)}
            detalle={`${mias.cantidad} ${mias.cantidad === 1 ? "venta" : "ventas"}`}
          />
          <TarjetaIndicador
            icono="caja"
            etiqueta="Caja"
            valor={turno ? "Abierta" : "Cerrada"}
            detalle={turno ? `desde las ${formatearHora(turno.abierto_en)}` : "abrila para empezar a vender"}
          />
        </div>
      )}
    </div>
  );
}
