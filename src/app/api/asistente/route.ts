import Anthropic from "@anthropic-ai/sdk";
import { crearLimitador, validarConversacion } from "@/lib/asistente/conversacion";
import { ejecutarHerramienta } from "@/lib/asistente/herramientas";
import { responder } from "@/lib/asistente/motor";
import { diaArgentina } from "@/lib/fechas";
import { obtenerSesion } from "@/lib/sesion";

// El asistente puede encadenar varias consultas: damos margen antes de que Vercel corte.
export const maxDuration = 60;

const POR_MINUTO = crearLimitador({ maximo: 12, ventanaMs: 60_000 });
const POR_HORA = crearLimitador({ maximo: 120, ventanaMs: 3_600_000 });
const MAX_BYTES = 20_000;

const json = (cuerpo: Record<string, unknown>, status = 200) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(pedido: Request) {
  // 1) Solo desde nuestra propia página (defensa extra contra pedidos cruzados entre sitios).
  const origen = pedido.headers.get("origin");
  if (origen && new URL(origen).host !== pedido.headers.get("host")) return json({ error: "Pedido no permitido." }, 403);

  // 2) Quién es. Sin sesión no se gasta nada.
  const sesion = await obtenerSesion();
  if (!sesion) return json({ error: "Tu sesión venció. Volvé a ingresar." }, 401);

  // 3) Frenos de uso y de tamaño.
  if (!POR_MINUTO.permitir(sesion.user.id) || !POR_HORA.permitir(sesion.user.id)) {
    return json({ error: "Estás preguntando muy rápido. Esperá un momento y probá de nuevo." }, 429);
  }
  const largo = Number(pedido.headers.get("content-length") ?? "0");
  if (largo > MAX_BYTES) return json({ error: "El mensaje es demasiado largo." }, 413);

  let cuerpo: unknown;
  try {
    const texto = await pedido.text();
    if (texto.length > MAX_BYTES) return json({ error: "El mensaje es demasiado largo." }, 413);
    cuerpo = JSON.parse(texto);
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const conversacion = validarConversacion(cuerpo);
  if (!conversacion.ok) return json({ error: conversacion.error }, 400);

  // 4) La llave vive SOLO en el servidor (variable de entorno). Si falta, el asistente avisa en vez de romper.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "El asistente todavía no está activado. Falta configurar su llave en el servidor.", codigo: "sin_configurar" }, 503);

  const cliente = new Anthropic({ apiKey, maxRetries: 1, timeout: 50_000 });
  const hoy = diaArgentina(new Date());

  try {
    const r = await responder({
      cliente,
      mensajes: conversacion.mensajes,
      rol: sesion.perfil.rol,
      nombre: sesion.perfil.nombre,
      ejecutar: (nombre, entrada) => ejecutarHerramienta(nombre, entrada, { supabase: sesion.supabase, rol: sesion.perfil.rol, hoy }),
    });
    return json({ texto: r.texto });
  } catch (e) {
    // Nunca se devuelve el detalle del error al navegador: puede contener datos internos.
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("Asistente: la llave de Anthropic fue rechazada", e.status);
      return json({ error: "El asistente no está bien configurado. Avisale a quien administra el sistema.", codigo: "sin_configurar" }, 503);
    }
    if (e instanceof Anthropic.RateLimitError) return json({ error: "El asistente está muy ocupado. Probá de nuevo en un minuto." }, 429);
    if (e instanceof Anthropic.APIConnectionError) return json({ error: "No pude conectarme con el asistente. Probá de nuevo." }, 502);
    console.error("Asistente: error inesperado", e instanceof Anthropic.APIError ? e.status : e);
    return json({ error: "El asistente tuvo un problema. Probá de nuevo." }, 500);
  }
}
