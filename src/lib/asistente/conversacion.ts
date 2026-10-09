/**
 * Reglas de seguridad y de costo para lo que llega al asistente desde el navegador. El navegador es
 * un lugar donde cualquiera puede mandar lo que quiera, así que acá se valida TODO antes de gastar
 * un centavo con el modelo.
 */

export const MAX_MENSAJES = 12; // cuántos mensajes de historial se aceptan
export const MAX_LARGO_MENSAJE = 1000; // caracteres por mensaje

export type MensajeChat = { role: "user" | "assistant"; content: string };

export type ResultadoConversacion = { ok: true; mensajes: MensajeChat[] } | { ok: false; error: string };

export function validarConversacion(cuerpo: unknown): ResultadoConversacion {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) return { ok: false, error: "Pedido inválido." };
  const lista = (cuerpo as Record<string, unknown>).mensajes;
  if (!Array.isArray(lista) || lista.length === 0) return { ok: false, error: "Escribí una pregunta." };
  if (lista.length > MAX_MENSAJES) return { ok: false, error: "La conversación es muy larga. Empezá una nueva." };

  const mensajes: MensajeChat[] = [];
  for (const m of lista) {
    if (typeof m !== "object" || m === null) return { ok: false, error: "Pedido inválido." };
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return { ok: false, error: "Pedido inválido." };
    const texto = content.trim();
    if (texto === "") return { ok: false, error: "Hay un mensaje vacío." };
    if (texto.length > MAX_LARGO_MENSAJE) return { ok: false, error: `Cada mensaje admite hasta ${MAX_LARGO_MENSAJE} caracteres.` };
    mensajes.push({ role, content: texto });
  }

  // La API pide que empiece y termine con el usuario, alternando. Lo exigimos para no gastar en pedidos rotos.
  if (mensajes[0].role !== "user" || mensajes[mensajes.length - 1].role !== "user") return { ok: false, error: "Pedido inválido." };
  for (let i = 1; i < mensajes.length; i++) {
    if (mensajes[i].role === mensajes[i - 1].role) return { ok: false, error: "Pedido inválido." };
  }
  return { ok: true, mensajes };
}

/**
 * Límite de uso por persona: ventana deslizante en memoria. En Vercel cada instancia lleva su propia
 * cuenta, así que es un freno de mano contra abusos y errores (un bucle, un doble clic infinito),
 * no una cuota exacta.
 */
export function crearLimitador({ maximo, ventanaMs, ahora = () => Date.now() }: { maximo: number; ventanaMs: number; ahora?: () => number }) {
  const registros = new Map<string, number[]>();
  return {
    /** true si puede pasar (y lo anota); false si ya usó todo en esta ventana. */
    permitir(clave: string): boolean {
      const t = ahora();
      const recientes = (registros.get(clave) ?? []).filter((x) => t - x < ventanaMs);
      if (recientes.length >= maximo) {
        registros.set(clave, recientes);
        return false;
      }
      recientes.push(t);
      registros.set(clave, recientes);
      // Limpieza: que el mapa no crezca para siempre.
      if (registros.size > 5000) for (const [k, v] of registros) if (v.every((x) => t - x >= ventanaMs)) registros.delete(k);
      return true;
    },
  };
}
