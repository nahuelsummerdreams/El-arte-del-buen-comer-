import type { ProductoVendido } from "@/lib/panel";
import { formatearCantidad, formatearPesos } from "@/lib/precios";

export function TablaMasVendidos({ productos }: { productos: ProductoVendido[] }) {
  if (productos.length === 0) {
    return <p className="py-8 text-center text-sm text-crema/55">Todavía no hay ventas en este período.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-crema/50">
        <tr>
          <th className="w-8 pb-2 font-normal">#</th>
          <th className="pb-2 font-normal">Producto</th>
          <th className="pb-2 pl-4 text-right font-normal">Vendido</th>
          <th className="pb-2 pl-4 text-right font-normal">Importe</th>
        </tr>
      </thead>
      <tbody>
        {productos.map((p, i) => (
          <tr key={p.producto_id} data-vendido={p.producto_id} className="border-t border-crema/10">
            <td className="py-2.5 text-crema/50 tabular-nums">{i + 1}</td>
            <td className="py-2.5 pr-2 font-medium">{p.nombre}</td>
            <td className="py-2.5 pl-4 text-right tabular-nums">{formatearCantidad(p.cantidad, p.tipo_venta)}</td>
            <td className="py-2.5 pl-4 text-right tabular-nums">{formatearPesos(p.ingresos)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
