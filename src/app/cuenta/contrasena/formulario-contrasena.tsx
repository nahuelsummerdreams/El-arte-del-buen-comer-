"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cambiarContrasenaAccion, type EstadoContrasena } from "./actions";

const campo =
  "w-full rounded-lg border bg-white/5 px-3.5 py-3 pr-20 text-base outline-none focus:border-crema/60";
const borde = (hayError: boolean) => (hayError ? "border-red-400/70" : "border-crema/20");

const estadoInicial: EstadoContrasena = { errores: {}, mensaje: null, exito: false };

export function FormularioContrasena() {
  const [estado, accion, enviando] = useActionState(cambiarContrasenaAccion, estadoInicial);
  const [ver, setVer] = useState(false);
  const { errores } = estado;

  if (estado.exito) {
    return (
      <div role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-5 py-6">
        <p className="text-lg font-medium text-emerald-100">Contraseña actualizada.</p>
        <p className="mt-1 text-sm text-emerald-100/80">
          Desde ahora entrá con la nueva. Si el navegador te ofrece guardarla, aceptá.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">
          Volver al panel
        </Link>
      </div>
    );
  }

  const tipo = ver ? "text" : "password";
  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      {estado.mensaje && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {estado.mensaje}
        </p>
      )}

      {[
        { id: "actual", etiqueta: "Contraseña actual", autoComplete: "current-password" },
        { id: "nueva", etiqueta: "Nueva contraseña", autoComplete: "new-password" },
        { id: "repetir", etiqueta: "Repetí la nueva contraseña", autoComplete: "new-password" },
      ].map((c, i) => {
        const error = errores[c.id as "actual" | "nueva" | "repetir"];
        return (
          <div key={c.id} className="flex flex-col gap-1.5">
            <label htmlFor={c.id} className="text-sm">{c.etiqueta}</label>
            <div className="relative">
              <input
                id={c.id}
                name={c.id}
                type={tipo}
                autoComplete={c.autoComplete}
                aria-invalid={!!error}
                className={`${campo} ${borde(!!error)}`}
              />
              {i === 0 && (
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-pressed={ver}
                  className="absolute inset-y-0 right-0 px-3.5 text-sm text-crema/60 transition hover:text-crema"
                >
                  {ver ? "Ocultar" : "Mostrar"}
                </button>
              )}
            </div>
            {error && <p data-error={c.id} className="text-sm text-red-300">{error}</p>}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-crema px-5 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Cambiar contraseña"}
        </button>
        <Link href="/" className="px-3 py-2.5 text-sm text-crema/70 hover:text-crema">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
