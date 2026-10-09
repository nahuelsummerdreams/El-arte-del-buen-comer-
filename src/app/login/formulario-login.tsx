"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, type EstadoLogin } from "./actions";

const campo =
  "w-full rounded-lg border border-crema/20 bg-white/5 px-3.5 py-3 text-base outline-none transition placeholder:text-crema/30 focus:border-crema/60 focus:bg-white/[0.07]";

// "use client" porque usa useActionState (para mostrar el error sin recargar y deshabilitar el
// botón mientras se envía) y un poco de estado para mostrar/ocultar la contraseña.
// El login en sí corre en el servidor.
export function FormularioLogin({ emailInicial }: { emailInicial: string }) {
  const [estado, accion, enviando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {
    error: null,
    email: emailInicial,
    intento: 0,
  });
  const [verClave, setVerClave] = useState(false);

  return (
    // key: tras cada respuesta los campos se vuelven a crear. Así el email queda escrito
    // aunque React reinicie el formulario, y la contraseña se vacía (a propósito).
    <form key={estado.intento} action={accion} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-crema/80">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={estado.email}
          // Si el correo ya está recordado, el cursor va directo a la contraseña.
          autoFocus={estado.email === ""}
          required
          placeholder="tu@correo.com"
          className={campo}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-crema/80">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            autoFocus={estado.email !== ""}
            required
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-pressed={verClave}
            className="absolute inset-y-0 right-0 px-3.5 text-sm text-crema/60 transition hover:text-crema"
          >
            {verClave ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-lg bg-crema px-4 py-3 font-medium text-tinta shadow-lg shadow-black/30 transition hover:bg-crema/90 active:scale-[0.99] disabled:opacity-60"
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
