import Link from "next/link";
import type { ReactNode } from "react";
import { formatearHora } from "@/lib/fechas";
import {
  etiquetaDiaLarga,
  ticketPromedio,
  type DiaVenta,
  type MedioVendido,
  type ProductoParaReponer,
  type ProductoVendido,
} from "@/lib/panel";
import { formatearPesos } from "@/lib/precios";
import { BarrasMedios } from "./barras-medios";
import { FiltroPeriodo, type Periodo } from "./filtro-periodo";
import { GraficoVentas } from "./grafico-ventas";
import { ListaReponer } from "./lista-reponer";
import { TablaMasVendidos } from "./tabla-mas-vendidos";
import { TarjetaIndicador } from "./tarjeta-indicador";

/*
 * Esta pieza SOLO DIBUJA: recibe los datos ya cargados y no sabe de dónde vinieron (base de datos,
 * pruebas, ejemplos). Cargar y dibujar por separado hace el código más fácil de entender y permite
 * ver el diseño sin tocar datos reales.
 */

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function Seccion({ titulo, subtitulo, children, className = "" }: { titulo: string; subtitulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-crema/10 bg-white/[0.04] p-5 ${className}`}>
      <h2 className="text-lg font-medium">{titulo}</h2>
      {subtitulo ? <p className="mb-4 text-sm text-crema/55">{subtitulo}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function Fallo({ texto }: { texto: string }) {
  return <p role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">{texto}</p>;
}

export function Encabezado({ nombre, hoy, cajaAbiertaDesde }: { nombre: string; hoy: string; cajaAbiertaDesde: string | null }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-crema/60">{mayuscula(etiquetaDiaLarga(hoy))}</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">Hola, {nombre}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-crema/65">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${cajaAbiertaDesde ? "bg-emerald-400" : "bg-crema/35"}`} />
          {cajaAbiertaDesde ? `Caja abierta desde las ${formatearHora(cajaAbiertaDesde)}` : "La caja está cerrada"}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/venta" className="rounded-xl bg-crema px-6 py-3 font-semibold text-tinta shadow-lg shadow-black/30 transition hover:bg-crema/90">
          Vender
        </Link>
        <Link href="/caja" className="rounded-xl border border-crema/25 px-5 py-3 text-sm font-medium transition hover:bg-white/5">
          {cajaAbiertaDesde ? "Ver caja" : "Abrir caja"}
        </Link>
      </div>
    </header>
  );
}

export type DatosPanelDueno = {
  nombre: string;
  /** Hoy, como "AAAA-MM-DD" en hora de Argentina. */
  hoy: string;
  periodo: Periodo;
  /** Los últimos 30 días, uno por uno (aun los que no tuvieron ventas). El último es hoy. */
  serie: DiaVenta[];
  medios: MedioVendido[];
  masVendidos: ProductoVendido[];
  paraReponer: ProductoParaReponer[];
  /** Instante en que se abrió la caja, o null si está cerrada. */
  cajaAbiertaDesde: string | null;
  efectivoEnCaja: number | null;
};

export function VistaPanelDueno(d: DatosPanelDueno) {
  const delDia = d.serie[d.serie.length - 1];
  const ayer = d.serie[d.serie.length - 2];
  const ticketHoy = ticketPromedio(delDia.total, delDia.cantidad);
  const ticketAyer = ticketPromedio(ayer.total, ayer.cantidad);
  const sinStock = d.paraReponer.filter((p) => p.estado === "sin_stock").length;

  const dias = d.serie.slice(-d.periodo);
  const totalPeriodo = dias.reduce((s, x) => s + x.total, 0);
  const ventasPeriodo = dias.reduce((s, x) => s + x.cantidad, 0);

  return (
    <div className="space-y-6">
      <Encabezado nombre={d.nombre} hoy={d.hoy} cajaAbiertaDesde={d.cajaAbiertaDesde} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <TarjetaIndicador
          grande
          icono="tendencia"
          etiqueta="Ventas de hoy"
          valor={formatearPesos(delDia.total)}
          detalle={plural(delDia.cantidad, "venta", "ventas")}
          comparar={delDia.cantidad > 0 ? { actual: delDia.total, anterior: ayer.total, contra: "ayer" } : undefined}
          serie={d.serie.slice(-12).map((x) => x.total)}
        />
        <TarjetaIndicador
          icono="ticket"
          etiqueta="Ticket promedio"
          valor={formatearPesos(ticketHoy)}
          detalle="por venta, hoy"
          comparar={delDia.cantidad > 0 ? { actual: ticketHoy, anterior: ticketAyer, contra: "ayer" } : undefined}
        />
        <TarjetaIndicador
          icono="caja"
          etiqueta="Efectivo en caja"
          valor={d.efectivoEnCaja !== null ? formatearPesos(d.efectivoEnCaja) : "Cerrada"}
          detalle={d.cajaAbiertaDesde && d.efectivoEnCaja !== null ? `abierta desde las ${formatearHora(d.cajaAbiertaDesde)}` : "abrila para empezar a vender"}
        />
        <TarjetaIndicador
          icono="alerta"
          etiqueta="Para reponer"
          valor={String(d.paraReponer.length)}
          detalle={d.paraReponer.length === 0 ? "todo en orden" : sinStock > 0 ? `${sinStock} sin stock` : "con stock bajo"}
          acento={d.paraReponer.length > 0 ? "atencion" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-crema/60">Mostrando los últimos {d.periodo} días</p>
        <FiltroPeriodo actual={d.periodo} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Seccion titulo="Ventas día por día" subtitulo={`${formatearPesos(totalPeriodo)} en ${plural(ventasPeriodo, "venta", "ventas")}`}>
          <GraficoVentas key={d.periodo} dias={dias} />
        </Seccion>
        <Seccion titulo="Cobrado por medio de pago">
          <BarrasMedios medios={d.medios} />
        </Seccion>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Seccion titulo="Productos más vendidos" subtitulo="Por importe, en el período elegido">
          <TablaMasVendidos productos={d.masVendidos} />
        </Seccion>
        <Seccion titulo="Para reponer" subtitulo="Sin stock o por debajo del mínimo">
          <ListaReponer productos={d.paraReponer.slice(0, 6)} />
        </Seccion>
      </div>
    </div>
  );
}
