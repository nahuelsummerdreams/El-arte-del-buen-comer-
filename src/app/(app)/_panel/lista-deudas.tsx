import Link from "next/link";
import type { EstadoDeuda } from "@/lib/costos";
import { formatearPesos } from "@/lib/precios";

export type DeudaVisible = { id: number; producto: string; proveedor: string | null; monto: number; estado: EstadoDeuda };

const estilo = { vencida: "bg-red-400/10 text-red-300", hoy: "bg-amber-400/10 text-amber-300", proxima: "bg-white/5 text-crema/70", sin_fecha: "bg-white/5 text-crema/60" } as const;

export function ListaDeudas({ total, deudas }: { total: number; deudas: DeudaVisible[] }) {
  if (deudas.length === 0) {
    return <p data-deudas-vacio className="py-8 text-center text-sm text-emerald-300">✓ No le debés nada a nadie.</p>;
  }
  return (
    <div>
      <p data-total-deuda className="text-2xl font-semibold tabular-nums">{formatearPesos(total)}</p>
      <ul className="mt-2 divide-y divide-crema/10">
        {deudas.slice(0, 4).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{d.proveedor ?? d.producto}</span>
              <span className="text-xs text-crema/55">{formatearPesos(d.monto)}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${estilo[d.estado.estado]}`}>{d.estado.texto}</span>
          </li>
        ))}
      </ul>
      <Link href="/proveedores" className="mt-3 inline-block text-sm text-crema/80 underline underline-offset-4 hover:text-crema">
        {deudas.length > 4 ? `Ver las ${deudas.length} cuentas` : "Ver proveedores"}
      </Link>
    </div>
  );
}
