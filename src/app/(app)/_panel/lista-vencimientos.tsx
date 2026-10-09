import Link from "next/link";
import { Icono } from "@/components/icono";
import { estadoVencimiento, textoVencimiento, type FilaVencimiento } from "@/lib/costos";
import { formatearStock } from "@/lib/precios";

const estilo = {
  vencido: "bg-red-400/10 text-red-300",
  hoy: "bg-red-400/10 text-red-300",
  urgente: "bg-amber-400/10 text-amber-300",
  proximo: "bg-white/5 text-crema/70",
} as const;

/** Lo que vence pronto y todavía hay para vender. La urgencia se dice con palabras, no solo con color. */
export function ListaVencimientos({ filas }: { filas: FilaVencimiento[] }) {
  if (filas.length === 0) {
    return <p data-venc-vacio className="py-8 text-center text-sm text-emerald-300">✓ Nada vence en los próximos 7 días.</p>;
  }
  return (
    <ul className="divide-y divide-crema/10">
      {filas.map((f) => {
        const e = estadoVencimiento(f.dias_restantes);
        return (
          <li key={f.lote_id} data-vencimiento={f.lote_id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{f.nombre}</span>
              <span className="text-xs text-crema/55">Quedan unos {formatearStock(f.quedan, f.tipo_venta)}</span>
            </span>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${estilo[e]}`}>
              <Icono nombre="reloj" className="h-3.5 w-3.5" /> {textoVencimiento(f.dias_restantes)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function EnlacePerdida() {
  return (
    <Link href="/inventario/merma" className="mt-3 inline-block text-sm text-crema/80 underline underline-offset-4 hover:text-crema">
      Registrar una pérdida
    </Link>
  );
}
