import Link from "next/link";
import { Icono } from "@/components/icono";
import type { ProductoParaReponer } from "@/lib/panel";
import { formatearStock } from "@/lib/precios";

/** Qué conviene reponer. El estado lleva ícono y palabra, no solo color. */
export function ListaReponer({ productos }: { productos: ProductoParaReponer[] }) {
  if (productos.length === 0) {
    return (
      <p data-reponer-vacio className="py-8 text-center text-sm text-emerald-300">
        ✓ Todo en orden: ningún producto para reponer.
      </p>
    );
  }
  return (
    <div>
      <ul className="divide-y divide-crema/10">
        {productos.map((p) => (
          <li key={p.id} data-reponer={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.nombre}</span>
              <span className="text-xs text-crema/55">Stock: {formatearStock(p.stock, p.tipoVenta)}</span>
            </span>
            {p.estado === "sin_stock" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-400/10 px-2.5 py-1 text-xs font-medium text-red-300">
                <Icono nombre="alerta" className="h-3.5 w-3.5" /> Sin stock
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                <Icono nombre="alerta" className="h-3.5 w-3.5" /> Stock bajo
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link href="/inventario/ingreso" className="mt-3 inline-block text-sm text-crema/80 underline underline-offset-4 hover:text-crema">
        Ingresar mercadería
      </Link>
    </div>
  );
}
