import { cookies } from "next/headers";
import Image from "next/image";
import { Suspense } from "react";
import { BotonTema } from "@/components/boton-tema";
import { COOKIE_ULTIMO_EMAIL } from "./cookies";
import { FormularioLogin } from "./formulario-login";

// Con Cache Components, lo que se ve al instante (logo, "Bienvenido") es la carcasa estática;
// el formulario espera a saber si hay un email recordado, que depende de las cookies del pedido.
export default function PaginaLogin() {
  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Resplandor cálido de madera detrás del logo: da profundidad sin recargar la pantalla. */}
      <div
        aria-hidden
        className="fx-respirar pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_28%,rgba(107,66,38,0.38),transparent_72%)]"
      />

      <BotonTema className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-crema/20 text-crema/80 transition hover:bg-white/5" />

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Image
          src="/logo.jpg"
          alt="Logo de El Arte del Buen Comer"
          width={754}
          height={765}
          priority
          className="h-36 w-36 rounded-full object-cover ring-1 ring-crema/25 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
        />

        <p className="mt-9 text-[0.7rem] uppercase tracking-[0.38em] text-crema/55">
          El Arte del Buen Comer
        </p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">Bienvenido</h1>
        <p className="mt-3 text-sm text-crema/60">Ingresá para gestionar tu negocio</p>

        <div className="mt-9 w-full rounded-2xl border border-crema/10 bg-white/[0.04] p-6 text-left shadow-2xl shadow-black/40 backdrop-blur">
          <Suspense fallback={<FormularioCargando />}>
            <FormularioConEmailRecordado />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function FormularioConEmailRecordado() {
  const almacen = await cookies();
  // El valor viene de una cookie (o sea, del navegador): solo lo usamos como texto inicial del
  // campo, acotado en largo. React lo escapa, así que no puede inyectar nada.
  const emailInicial = almacen.get(COOKIE_ULTIMO_EMAIL)?.value.slice(0, 254) ?? "";
  return <FormularioLogin emailInicial={emailInicial} />;
}

function FormularioCargando() {
  // Misma altura que el formulario real para que la pantalla no "salte" al cargar.
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-[4.4rem] animate-pulse rounded-lg bg-white/5" />
      <div className="h-[4.4rem] animate-pulse rounded-lg bg-white/5" />
      <div className="h-12 animate-pulse rounded-lg bg-white/10" />
    </div>
  );
}
