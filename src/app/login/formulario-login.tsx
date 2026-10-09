"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = { error: null };

// "use client" porque usa useActionState (estado en el navegador para mostrar el error
// y deshabilitar el botón mientras se envía). El login en sí corre en el servidor.
export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, estadoInicial);

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-crema/20 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-crema/20 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-crema/60"
        />
      </label>

      {estado.error && (
        <p role="alert" className="text-sm text-red-300">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-crema px-4 py-2.5 font-medium text-tinta transition hover:bg-crema/90 disabled:opacity-60"
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
