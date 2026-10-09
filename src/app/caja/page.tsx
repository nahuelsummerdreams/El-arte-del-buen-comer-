import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { leerResumenTurno } from "@/lib/caja";
import { formatearFechaHora, formatearHora } from "@/lib/fechas";
import { formatearPesos } from "@/lib/precios";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioAbrirCaja, FormularioCerrarCaja, FormularioMovimiento } from "./formularios";
import { ResumenCaja } from "./resumen-caja";

export default function PaginaCaja(props: PageProps<"/caja">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-crema/60 hover:text-crema">← Panel</Link>
      <h1 className="mb-6 mt-3 text-3xl font-semibold tracking-tight">Caja</h1>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-white/5" aria-busy="true" />}>
        <Contenido searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p role="status" className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">{texto}</p>
  );
}

const ETIQUETA_TIPO = { retiro: "Retiro", gasto: "Gasto", ingreso: "Ingreso" } as const;

async function Contenido({ searchParams }: { searchParams: PageProps<"/caja">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  const { supabase } = sesion;
  const q = await searchParams;

  const { data: turno, error } = await supabase
    .from("turnos_caja")
    .select("id, abierto_en, efectivo_inicial_centavos")
    .is("cerrado_en", null)
    .maybeSingle();
  if (error) {
    return <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200">No pudimos cargar la caja. Intentá de nuevo en un momento.</p>;
  }

  // ------------------------------------------------------------ CAJA ABIERTA
  if (turno) {
    const [resumenJson, movimientos] = await Promise.all([
      supabase.rpc("resumen_turno", { p_turno_id: turno.id }),
      supabase.from("movimientos_caja").select("id, tipo, monto_centavos, motivo, creado_en").eq("turno_id", turno.id).order("creado_en", { ascending: false }),
    ]);
    const resumen = leerResumenTurno(resumenJson.data);

    return (
      <div className="flex flex-col gap-8">
        <div>
          {q.abierta === "1" && <Aviso texto="Caja abierta. ¡Buen turno!" />}
          {q.mov === "1" && <Aviso texto="Movimiento registrado." />}
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden /> Caja abierta desde las {formatearHora(turno.abierto_en)}
          </p>
        </div>

        {resumen ? <ResumenCaja resumen={resumen} /> : <p role="alert" className="text-red-200">No pudimos calcular el resumen del turno.</p>}

        <section>
          <h2 className="mb-3 text-lg font-medium">Retiros, gastos e ingresos de efectivo</h2>
          <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-4">
            <FormularioMovimiento />
          </div>
          {movimientos.data && movimientos.data.length > 0 && (
            <ul className="mt-3 divide-y divide-crema/10 rounded-xl border border-crema/10 text-sm">
              {movimientos.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate">
                    <span className="text-crema/60">{formatearHora(m.creado_en)} · {ETIQUETA_TIPO[m.tipo]} · </span>{m.motivo}
                  </span>
                  <span className="shrink-0 tabular-nums">{m.tipo === "ingreso" ? "+" : "−"} {formatearPesos(m.monto_centavos)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Cerrar la caja</h2>
          <p className="mb-3 text-sm text-crema/60">Contá el efectivo del cajón y escribilo: el sistema calcula la diferencia.</p>
          <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-4">
            <FormularioCerrarCaja />
          </div>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------ CAJA CERRADA
  const { data: ultimo } = await supabase
    .from("turnos_caja")
    .select("id, abierto_en, cerrado_en, nota")
    .not("cerrado_en", "is", null)
    .order("cerrado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  const resumenUltimo = ultimo ? leerResumenTurno((await supabase.rpc("resumen_turno", { p_turno_id: ultimo.id })).data) : null;

  return (
    <div className="flex flex-col gap-8">
      {q.cierre === "1" && <Aviso texto="Caja cerrada." />}

      <section>
        <p className="mb-3 flex items-center gap-2 text-sm text-crema/60">
          <span className="h-2.5 w-2.5 rounded-full bg-crema/40" aria-hidden /> La caja está cerrada
        </p>
        <div className="rounded-xl border border-crema/10 bg-white/[0.03] p-4">
          <FormularioAbrirCaja />
        </div>
      </section>

      {ultimo && resumenUltimo && (
        <section>
          <h2 className="mb-1 text-lg font-medium">Último cierre</h2>
          <p className="mb-3 text-sm text-crema/60">
            {formatearFechaHora(ultimo.abierto_en)} → {formatearFechaHora(ultimo.cerrado_en!)}
            {ultimo.nota ? ` · «${ultimo.nota}»` : ""}
          </p>
          <ResumenCaja resumen={resumenUltimo} />
        </section>
      )}
    </div>
  );
}
