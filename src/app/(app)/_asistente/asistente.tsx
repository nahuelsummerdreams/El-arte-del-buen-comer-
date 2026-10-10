"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icono } from "@/components/icono";
import { MAX_LARGO_MENSAJE } from "@/lib/asistente/conversacion";
import { formatearRespuesta, type Segmento } from "@/lib/asistente/formato";

type Mensaje = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGERENCIAS = {
  dueno: ["¿Cuánto vendí hoy?", "¿Qué tengo que reponer?", "¿Qué vence pronto?", "¿Cómo voy con la meta del mes?", "¿Cómo ingreso mercadería?"],
  cajero: ["¿Cómo cobro una venta?", "¿Cómo abro la caja?", "¿Cuánto stock hay de jamón?"],
} as const;

const Texto = ({ partes }: { partes: Segmento[] }) =>
  partes.map((p, i) => (p.negrita ? <strong key={i} className="font-semibold">{p.texto}</strong> : <span key={i}>{p.texto}</span>));

/** Dibuja la respuesta del asistente con componentes de React (nunca HTML crudo). */
function Respuesta({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      {formatearRespuesta(texto).map((b, i) =>
        b.tipo === "lista" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-miel">
            {b.items.map((it, j) => <li key={j}><Texto partes={it} /></li>)}
          </ul>
        ) : (
          <p key={i}>
            {b.lineas.map((l, j) => (
              <span key={j}>{j > 0 && <br />}<Texto partes={l} /></span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

/**
 * El asistente: un botón flotante que abre un chat. "use client" porque vive en el navegador
 * (abre/cierra, escribe, recibe respuestas). Todo lo delicado pasa en el servidor (/api/asistente):
 * la llave de IA, los permisos y los datos del negocio.
 */
export function Asistente({ rol, nombre }: { rol: "dueno" | "cajero"; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const primerNombre = nombre.trim().split(/\s+/)[0] || "";

  // Al llegar mensajes nuevos, bajar hasta el último.
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pensando, abierto]);

  // Al abrir, el cursor va directo al campo de escritura. ESC cierra y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    campo.current?.focus();
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim();
    if (limpia === "" || pensando) return;
    const historial: Mensaje[] = [...mensajes, { role: "user", content: limpia }];
    setMensajes(historial);
    setTexto("");
    setPensando(true);

    try {
      // Solo viajan los mensajes válidos (sin los de error) y los últimos 11: el servidor también lo controla.
      const aEnviar = historial.filter((m) => !m.error).slice(-11).map(({ role, content }) => ({ role, content }));
      while (aEnviar.length > 0 && aEnviar[0].role !== "user") aEnviar.shift();
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: aEnviar }),
        signal: AbortSignal.timeout(60_000),
      });
      const tipo = r.headers.get("content-type") ?? "";
      if (!tipo.includes("application/json")) {
        // Si la sesión venció, el servidor responde con la pantalla de ingreso (HTML), no con datos.
        throw new Error("Tu sesión venció. Volvé a ingresar.");
      }
      const datos = (await r.json()) as { texto?: string; error?: string };
      if (!r.ok || typeof datos.texto !== "string") throw new Error(datos.error ?? "El asistente tuvo un problema. Probá de nuevo.");
      setMensajes([...historial, { role: "assistant", content: datos.texto }]);
    } catch (e) {
      const mensaje = e instanceof Error && e.name !== "TimeoutError" && e.name !== "TypeError" ? e.message : "No pude conectarme. Revisá tu conexión y probá de nuevo.";
      setMensajes([...historial, { role: "assistant", content: mensaje, error: true }]);
    } finally {
      setPensando(false);
    }
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(texto);
  };
  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar(texto);
    }
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar el asistente" : "Abrir el asistente"}
        aria-expanded={abierto}
        data-asistente-boton
        className="no-imprimir fx-asistente-boton fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-madera text-white shadow-xl shadow-black/30 ring-2 ring-miel transition hover:scale-105 active:scale-95 max-sm:bottom-4 max-sm:right-4"
      >
        <span className="fx-giro grid place-items-center" key={abierto ? "x" : "a"}>
          {abierto ? <Icono nombre="cerrar" className="h-6 w-6" /> : <Image src="/logo.jpg" alt="" width={754} height={765} className="h-14 w-14 object-cover" />}
        </span>
      </button>

      {abierto && (
        <section
          role="dialog"
          aria-label="Asistente"
          data-asistente
          className="no-imprimir fx-panel-asistente fixed bottom-24 right-5 z-40 flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-crema/15 bg-tinta/95 shadow-2xl shadow-black/40 backdrop-blur-xl max-sm:bottom-20 max-sm:right-4 max-sm:w-[calc(100vw-2rem)]"
        >
          <header className="flex items-center gap-3 border-b border-crema/10 px-4 py-3">
            <span className="fx-brillo relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-miel">
              <Image src="/logo.jpg" alt="" width={754} height={765} className="h-10 w-10 object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight">Asistente</p>
              <p className="truncate text-xs text-crema/55">Te ayuda con el sistema y con tu negocio</p>
            </div>
            {mensajes.length > 0 && (
              <button type="button" onClick={() => setMensajes([])} className="rounded-lg border border-crema/20 px-2.5 py-1 text-xs text-crema/75 transition hover:bg-white/5">
                Nueva
              </button>
            )}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
            {mensajes.length === 0 && (
              <div className="fx-entra">
                <p className="text-base">Hola{primerNombre ? `, ${primerNombre}` : ""}</p>
                <p className="mt-1 text-crema/65">Preguntame cómo se hace algo o cómo viene el negocio. Por ejemplo:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGERENCIAS[rol].map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      style={{ "--i": i } as React.CSSProperties}
                      className="fx-entra rounded-full border border-crema/20 px-3 py-1.5 text-left text-xs text-crema/85 transition hover:border-miel hover:bg-miel/15"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="fx-mensaje flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-crema px-3.5 py-2 text-tinta">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="fx-mensaje flex items-end gap-2">
                  <Image src="/logo.jpg" alt="" width={754} height={765} className="mb-1 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-miel/60" />
                  <div
                    data-respuesta
                    className={`max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 ${m.error ? "border-red-400/40 bg-red-400/10 text-red-200" : "border-crema/10 bg-white/[0.04]"}`}
                  >
                    {m.error ? <p role="alert">{m.content}</p> : <Respuesta texto={m.content} />}
                  </div>
                </div>
              ),
            )}

            {pensando && (
              <div className="fx-mensaje flex items-end gap-2" data-pensando aria-label="El asistente está pensando">
                <Image src="/logo.jpg" alt="" width={754} height={765} className="mb-1 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-miel/60" />
                <span className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-crema/10 bg-white/[0.04] px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ animationDelay: `${i * 150}ms` }} className="fx-punto h-2 w-2 rounded-full bg-miel" />
                  ))}
                </span>
              </div>
            )}
            <div ref={fin} />
          </div>

          <form onSubmit={alEnviar} className="flex items-end gap-2 border-t border-crema/10 p-3">
            <label htmlFor="pregunta-asistente" className="sr-only">Tu pregunta</label>
            <textarea
              id="pregunta-asistente"
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              rows={1}
              maxLength={MAX_LARGO_MENSAJE}
              placeholder="Escribí tu pregunta…"
              className="max-h-28 min-h-[2.6rem] flex-1 resize-none rounded-xl border border-crema/20 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-miel"
            />
            <button
              type="submit"
              disabled={pensando || texto.trim() === ""}
              aria-label="Enviar"
              className="grid h-[2.6rem] w-[2.6rem] shrink-0 place-items-center rounded-xl bg-miel text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <Icono nombre="enviar" className="h-5 w-5" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
