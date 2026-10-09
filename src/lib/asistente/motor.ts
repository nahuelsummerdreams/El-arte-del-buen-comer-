import type Anthropic from "@anthropic-ai/sdk";
import type { MensajeChat } from "./conversacion";
import { construirSistema, type RolAsistente } from "./guia";
import { herramientasPara, type ResultadoHerramienta } from "./herramientas";

/** Lo mínimo que usamos del cliente de Anthropic (así las pruebas pueden usar uno falso). */
export type ClienteModelo = {
  messages: { create: (p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
};

export const MODELO = "claude-opus-5-5";
export const MAX_VUELTAS = 6; // cuántas veces puede pedir herramientas antes de dar la respuesta

export type RespuestaAsistente = { texto: string; herramientasUsadas: string[] };

const TEXTO_RECHAZO = "No puedo ayudarte con eso. Si es una duda del sistema o del negocio, probá reformularla.";
const TEXTO_LARGO = "Mi respuesta quedó cortada. ¿Me preguntás de nuevo, con algo más puntual?";
const TEXTO_SIN_RESPUESTA = "No logré armar una respuesta. ¿Podés reformular la pregunta?";

const textoDe = (c: Anthropic.ContentBlock[]) =>
  c.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

/**
 * El bucle del asistente: manda la conversación al modelo; si pide herramientas, las ejecuta y le
 * devuelve los resultados; repite hasta que responde con texto (o se corta por seguridad).
 */
export async function responder({
  cliente,
  mensajes,
  rol,
  nombre,
  ejecutar,
}: {
  cliente: ClienteModelo;
  mensajes: MensajeChat[];
  rol: RolAsistente;
  nombre: string;
  ejecutar: (nombre: string, entrada: unknown) => Promise<ResultadoHerramienta>;
}): Promise<RespuestaAsistente> {
  const conversacion: Anthropic.MessageParam[] = mensajes.map((m) => ({ role: m.role, content: m.content }));
  const usadas: string[] = [];

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const r = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: construirSistema(rol, nombre),
      tools: herramientasPara(rol),
      // Es un asistente de consulta: respuestas ágiles. (Con este modelo el pensamiento no se puede apagar, solo graduar.)
      output_config: { effort: "low" },
      messages: conversacion,
    });

    if (r.stop_reason === "refusal") return { texto: TEXTO_RECHAZO, herramientasUsadas: usadas };
    if (r.stop_reason === "max_tokens") return { texto: textoDe(r.content) || TEXTO_LARGO, herramientasUsadas: usadas };

    if (r.stop_reason !== "tool_use") {
      return { texto: textoDe(r.content) || TEXTO_SIN_RESPUESTA, herramientasUsadas: usadas };
    }

    // El modelo pidió herramientas. Se devuelve el turno ENTERO tal cual (incluye su razonamiento) y
    // los resultados de todas las herramientas juntos, en un único mensaje.
    conversacion.push({ role: "assistant", content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloque of r.content) {
      if (bloque.type !== "tool_use") continue;
      usadas.push(bloque.name);
      const res = await ejecutar(bloque.name, bloque.input);
      resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: res.texto, ...(res.esError ? { is_error: true } : {}) });
    }
    conversacion.push({ role: "user", content: resultados });
  }

  return { texto: "Tuve que consultar demasiadas cosas a la vez. Probá con una pregunta más puntual.", herramientasUsadas: usadas };
}
