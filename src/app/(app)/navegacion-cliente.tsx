"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotonTema } from "@/components/boton-tema";
import { Icono, type NombreIcono } from "@/components/icono";
import { iniciales } from "@/lib/panel";
import { BotonCerrarSesion } from "./boton-cerrar-sesion";

type Rol = "dueno" | "cajero";
type Item = { href: string; etiqueta: string; icono: NombreIcono; soloDueno?: boolean };

const MENU: Item[] = [
  { href: "/", etiqueta: "Panel", icono: "panel" },
  { href: "/venta", etiqueta: "Vender", icono: "vender" },
  { href: "/caja", etiqueta: "Caja", icono: "caja" },
  { href: "/calendario", etiqueta: "Calendario", icono: "calendario" },
];
const CATALOGO: Item[] = [
  { href: "/productos", etiqueta: "Productos", icono: "productos" },
  { href: "/stock", etiqueta: "Stock", icono: "ingreso" },
  { href: "/inventario/ingreso", etiqueta: "Ingresar mercadería", icono: "ingreso", soloDueno: true },
  { href: "/inventario/merma", etiqueta: "Registrar pérdida", icono: "papelera", soloDueno: true },
  { href: "/precios", etiqueta: "Actualizar precios", icono: "etiqueta", soloDueno: true },
];
const NEGOCIO: Item[] = [
  { href: "/ofertas", etiqueta: "Ofertas", icono: "etiqueta", soloDueno: true },
  { href: "/pedidos", etiqueta: "Pedidos a proveedor", icono: "ingreso", soloDueno: true },
  { href: "/proveedores", etiqueta: "Proveedores", icono: "tienda", soloDueno: true },
  { href: "/negocio", etiqueta: "Metas y gastos", icono: "meta", soloDueno: true },
];
const CUENTA: Item[] = [{ href: "/cuenta/contrasena", etiqueta: "Cambiar contraseña", icono: "llave" }];

const estaActivo = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

// "use client" solo para saber en qué pantalla estás (usePathname) y resaltarla.
export function NavegacionCliente({ nombre, rol }: { nombre: string; rol: Rol }) {
  const pathname = usePathname();
  const visibles = (items: Item[]) => items.filter((i) => !i.soloDueno || rol === "dueno");
  const etiquetaRol = rol === "dueno" ? "Dueño" : "Cajero";

  const enlace = (i: Item) => {
    const activo = estaActivo(pathname, i.href);
    return (
      <Link
        key={i.href}
        href={i.href}
        prefetch={false}
        aria-current={activo ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          activo ? "bg-crema font-medium text-tinta shadow-md shadow-black/20" : "text-crema/75 hover:bg-white/5 hover:text-crema"
        }`}
      >
        <Icono nombre={i.icono} />
        {i.etiqueta}
      </Link>
    );
  };

  const titulo = (t: string) => <p className="mb-1.5 mt-6 px-3 text-[0.65rem] uppercase tracking-[0.2em] text-crema/40">{t}</p>;

  return (
    <>
      {/* ------------------------------------------------------- escritorio: barra lateral */}
      <aside className="no-imprimir sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-crema/10 bg-black/20 p-4 lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2 py-1">
          <Image src="/logo.jpg" alt="" width={754} height={765} className="h-11 w-11 rounded-full object-cover ring-1 ring-crema/25" />
          <span className="font-display text-lg leading-tight">El Arte del Buen Comer</span>
        </Link>

        <nav aria-label="Principal" className="mt-4 flex-1 overflow-y-auto">
          {titulo("Menú")}
          <div className="space-y-1">{visibles(MENU).map(enlace)}</div>
          {titulo("Catálogo")}
          <div className="space-y-1">{visibles(CATALOGO).map(enlace)}</div>
          {visibles(NEGOCIO).length > 0 && titulo("Negocio")}
          <div className="space-y-1">{visibles(NEGOCIO).map(enlace)}</div>
          {titulo("Cuenta")}
          <div className="space-y-1">{visibles(CUENTA).map(enlace)}</div>
        </nav>

        <div className="rounded-xl border border-crema/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-madera text-sm font-semibold text-crema">
              {iniciales(nombre)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nombre}</p>
              <p className="text-xs text-crema/55">{etiquetaRol}</p>
            </div>
          </div>
          <BotonTema conTexto className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-crema/20 px-3 py-2 text-sm text-crema/80 transition hover:bg-white/5 hover:text-crema" />
          <BotonCerrarSesion className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-crema/20 px-3 py-2 text-sm text-crema/80 transition hover:bg-white/5 hover:text-crema" />
        </div>
      </aside>

      {/* ------------------------------------------------------------- celular: barra superior */}
      <header className="no-imprimir sticky top-0 z-30 border-b border-crema/10 bg-tinta/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image src="/logo.jpg" alt="" width={754} height={765} className="h-9 w-9 rounded-full object-cover ring-1 ring-crema/25" />
            <span className="truncate font-display">El Arte del Buen Comer</span>
          </Link>
          <span className="flex shrink-0 items-center gap-2">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-madera text-xs font-semibold text-crema">{iniciales(nombre)}</span>
            <BotonTema className="grid h-8 w-8 place-items-center rounded-lg border border-crema/20 text-crema/80" />
            <BotonCerrarSesion className="rounded-lg border border-crema/20 px-2.5 py-1.5 text-xs text-crema/80" etiquetaCorta />
          </span>
        </div>
        <nav aria-label="Principal" className="flex gap-2 overflow-x-auto px-4 pb-2.5">
          {[...visibles(MENU), ...visibles(CATALOGO), ...visibles(NEGOCIO), ...visibles(CUENTA)].map((i) => {
            const activo = estaActivo(pathname, i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                prefetch={false}
                aria-current={activo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${
                  activo ? "border-crema bg-crema font-medium text-tinta" : "border-crema/25 text-crema/80"
                }`}
              >
                <Icono nombre={i.icono} className="h-4 w-4" />
                {i.etiqueta}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
