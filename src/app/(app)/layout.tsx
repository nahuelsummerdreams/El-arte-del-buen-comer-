import { Suspense } from "react";
import { Navegacion, NavegacionCargando } from "./navegacion";

/**
 * Marco común de todas las pantallas del sistema (menos el login): barra lateral en
 * escritorio y barra superior en celular. La carpeta "(app)" agrupa las pantallas sin
 * cambiar sus direcciones (/venta sigue siendo /venta).
 */
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <Suspense fallback={<NavegacionCargando />}>
        <Navegacion />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
