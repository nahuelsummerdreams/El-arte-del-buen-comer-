"use client";

import { useSyncExternalStore } from "react";
import { Icono } from "@/components/icono";

type Tema = "claro" | "oscuro";

// El tema vive en el atributo data-tema del <html> (lo pone un script antes de dibujar la página).
// useSyncExternalStore es la forma correcta de leer algo "de afuera" de React sin romper la hidratación:
// el servidor siempre dibuja "oscuro" y, apenas carga en el navegador, se corrige al valor real.
const leer = (): Tema => (document.documentElement.dataset.tema === "claro" ? "claro" : "oscuro");
const leerServidor = (): Tema => "oscuro";
const avisos = new Set<() => void>();
const suscribir = (cb: () => void) => {
  avisos.add(cb);
  return () => avisos.delete(cb);
};

function cambiar(nuevo: Tema) {
  document.documentElement.dataset.tema = nuevo;
  try {
    localStorage.setItem("tema", nuevo);
  } catch {
    /* modo privado o sin almacenamiento: el cambio vale igual para esta visita */
  }
  avisos.forEach((cb) => cb());
}

/** Alterna entre modo noche (oscuro, el de la marca) y modo día (claro). */
export function BotonTema({ className = "", conTexto = false }: { className?: string; conTexto?: boolean }) {
  const tema = useSyncExternalStore(suscribir, leer, leerServidor);
  const alClaro = tema === "oscuro";
  const etiqueta = alClaro ? "Pasar a modo día" : "Pasar a modo noche";
  return (
    <button
      type="button"
      onClick={() => cambiar(alClaro ? "claro" : "oscuro")}
      aria-label={etiqueta}
      title={etiqueta}
      data-tema-boton
      className={className}
    >
      <Icono nombre={alClaro ? "sol" : "luna"} className="h-4 w-4" />
      {conTexto && <span>{alClaro ? "Modo día" : "Modo noche"}</span>}
    </button>
  );
}
