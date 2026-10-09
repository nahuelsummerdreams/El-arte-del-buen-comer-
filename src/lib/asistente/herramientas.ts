import type Anthropic from "@anthropic-ai/sdk";
import { calcularGanancia, estadoDeuda, estadoVencimiento, leerDeudas, leerResumenGanancia, leerVencimientos, textoVencimiento } from "@/lib/costos";
import { diaDelMes, primerDiaDelMes, proyectarMes } from "@/lib/metas";
import { leerMasVendidos, leerVentasPorDia, productosParaReponer, restarDias, ticketPromedio } from "@/lib/panel";
import { formatearCantidad, formatearPesos, formatearStock } from "@/lib/precios";
import type { RolAsistente } from "./guia";

/**
 * Las "manos" del asistente: consultas de SOLO LECTURA. Cada una corre con la sesión de quien pregunta,
 * así que valen las mismas reglas de seguridad de la base (RLS): un cajero no puede ver costos ni
 * ganancias aunque el modelo lo pidiera. Además acá se filtran por rol, por prolijidad.
 * Todas devuelven los importes YA formateados en pesos para que el modelo no tenga que hacer cuentas.
 */

// Tipo mínimo del cliente de Supabase que necesitamos (así las pruebas pueden usar uno falso).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClienteDatos = any;

export type ContextoHerramienta = { supabase: ClienteDatos; rol: RolAsistente; hoy: string };
export type ResultadoHerramienta = { texto: string; esError: boolean };

const SOLO_DUENO = new Set(["ventas_por_dia", "productos_mas_vendidos", "para_reponer", "vencimientos", "ganancia", "cuentas_a_pagar", "meta_del_mes"]);

export const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "stock_de_productos",
    description: "Busca productos por nombre y devuelve su stock actual y precio. Sin 'buscar' devuelve los primeros 15 por orden alfabético.",
    input_schema: { type: "object", properties: { buscar: { type: "string", description: "Parte del nombre, por ejemplo 'jamón' o 'coca'." } } },
  },
  {
    name: "ventas_por_dia",
    description: "Ventas de los últimos N días (uno por uno): cantidad de ventas, total y descuentos. El último día es hoy.",
    input_schema: { type: "object", properties: { dias: { type: "integer", description: "Entre 1 y 31. Por defecto 7." } } },
  },
  {
    name: "productos_mas_vendidos",
    description: "Ranking de productos más vendidos por importe en los últimos N días.",
    input_schema: {
      type: "object",
      properties: {
        dias: { type: "integer", description: "Entre 1 y 90. Por defecto 30." },
        limite: { type: "integer", description: "Cuántos devolver, entre 1 y 15. Por defecto 8." },
      },
    },
  },
  {
    name: "para_reponer",
    description: "Productos sin stock o por debajo del mínimo, del más urgente al menos urgente.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "vencimientos",
    description: "Mercadería que vence pronto (o ya venció) y todavía hay para vender, según la fecha de vencimiento cargada al ingresar.",
    input_schema: { type: "object", properties: { dias: { type: "integer", description: "Ventana en días hacia adelante, entre 0 y 60. Por defecto 7." } } },
  },
  {
    name: "ganancia",
    description: "Ganancia estimada de los últimos N días. Solo cuenta lo vendido que tiene costo cargado; informa qué porcentaje está cubierto.",
    input_schema: { type: "object", properties: { dias: { type: "integer", description: "Entre 1 y 90. Por defecto 30." } } },
  },
  {
    name: "cuentas_a_pagar",
    description: "Compras a cuenta que todavía no se pagaron, con proveedor, monto y fecha límite.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "meta_del_mes",
    description: "Meta de ventas del mes en curso: cuánto se vendió, avance, ritmo, proyección y cuánto falta vender por día.",
    input_schema: { type: "object", properties: {} },
  },
];

/** Qué herramientas puede ver cada rol. El cajero solo consulta stock y precios. */
export const herramientasPara = (rol: RolAsistente): Anthropic.Tool[] =>
  rol === "dueno" ? HERRAMIENTAS : HERRAMIENTAS.filter((h) => !SOLO_DUENO.has(h.name));

/** Entero dentro de un rango; si no viene o es raro, usa el valor por defecto. */
export function enteroEnRango(valor: unknown, min: number, max: number, defecto: number): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return defecto;
  return Math.min(max, Math.max(min, Math.trunc(valor)));
}

/** Deja solo letras, números, espacios y unos pocos signos: lo que se usa en un filtro de nombre. */
export function limpiarBusqueda(texto: unknown): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/[^\p{L}\p{N} .'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

// El formato de pesos usa un espacio "no separable"; para el modelo es mejor un espacio común.
const ok = (dato: unknown): ResultadoHerramienta => ({ texto: JSON.stringify(dato).replace(/[\u00a0\u202f]/g, " "), esError: false });
const fallo = (texto: string): ResultadoHerramienta => ({ texto, esError: true });
const sinDatos = () => fallo("No se pudieron leer los datos en este momento.");

export async function ejecutarHerramienta(nombre: string, entrada: unknown, ctx: ContextoHerramienta): Promise<ResultadoHerramienta> {
  const input = typeof entrada === "object" && entrada !== null ? (entrada as Record<string, unknown>) : {};
  const { supabase, rol, hoy } = ctx;

  if (!HERRAMIENTAS.some((h) => h.name === nombre)) return fallo(`No existe la herramienta «${nombre}».`);
  if (rol !== "dueno" && SOLO_DUENO.has(nombre)) return fallo("Este dato es solo para el dueño.");

  try {
    switch (nombre) {
      case "stock_de_productos": {
        const buscar = limpiarBusqueda(input.buscar);
        let consulta = supabase.from("productos_con_precio").select("id, nombre, tipo_venta, precio_centavos").eq("activo", true).order("nombre").limit(15);
        if (buscar !== "") consulta = consulta.ilike("nombre", `%${buscar}%`);
        const { data: productos, error } = await consulta;
        if (error || !Array.isArray(productos)) return sinDatos();
        if (productos.length === 0) return ok({ resultado: "No hay productos que coincidan." });
        const ids = productos.map((p: { id: number }) => p.id);
        const { data: stocks, error: e2 } = await supabase.from("stock_actual").select("producto_id, stock").in("producto_id", ids);
        if (e2 || !Array.isArray(stocks)) return sinDatos();
        const stockDe = new Map<number, number>(stocks.map((s: { producto_id: number; stock: number }) => [s.producto_id, s.stock ?? 0]));
        return ok({
          productos: productos.map((p: { id: number; nombre: string; tipo_venta: "peso" | "unidad"; precio_centavos: number | null }) => ({
            nombre: p.nombre,
            se_vende_por: p.tipo_venta === "peso" ? "peso (kilos)" : "unidad",
            precio: p.precio_centavos === null ? "sin precio" : `${formatearPesos(p.precio_centavos)} ${p.tipo_venta === "peso" ? "el kilo" : "cada una"}`,
            stock: formatearStock(stockDe.get(p.id) ?? 0, p.tipo_venta),
          })),
        });
      }

      case "ventas_por_dia": {
        const dias = enteroEnRango(input.dias, 1, 31, 7);
        const { data, error } = await supabase.rpc("ventas_por_dia", { p_dias: dias });
        const filas = error ? null : leerVentasPorDia(data);
        if (!filas) return sinDatos();
        const total = filas.reduce((s, f) => s + f.total, 0);
        const cantidad = filas.reduce((s, f) => s + f.cantidad, 0);
        return ok({
          desde: filas[0]?.dia,
          hasta: filas[filas.length - 1]?.dia,
          total_periodo: formatearPesos(total),
          ventas_periodo: cantidad,
          ticket_promedio: formatearPesos(ticketPromedio(total, cantidad)),
          dias: filas.map((f) => ({ dia: f.dia, ventas: f.cantidad, total: formatearPesos(f.total), descuentos: formatearPesos(f.descuentos) })),
        });
      }

      case "productos_mas_vendidos": {
        const dias = enteroEnRango(input.dias, 1, 90, 30);
        const limite = enteroEnRango(input.limite, 1, 15, 8);
        const { data, error } = await supabase.rpc("productos_mas_vendidos", { p_desde: restarDias(hoy, dias - 1), p_hasta: hoy, p_limite: limite });
        const filas = error ? null : leerMasVendidos(data);
        if (!filas) return sinDatos();
        return ok({
          periodo_dias: dias,
          ranking: filas.map((f, i) => ({ puesto: i + 1, producto: f.nombre, vendido: formatearCantidad(f.cantidad, f.tipo_venta), importe: formatearPesos(f.ingresos) })),
        });
      }

      case "para_reponer": {
        const [p, s] = await Promise.all([
          supabase.from("productos_con_precio").select("id, nombre, tipo_venta, stock_minimo").eq("activo", true),
          supabase.from("stock_actual").select("producto_id, stock"),
        ]);
        if (p.error || s.error || !Array.isArray(p.data) || !Array.isArray(s.data)) return sinDatos();
        const stockDe = new Map<number, number>(s.data.map((x: { producto_id: number; stock: number }) => [x.producto_id, x.stock ?? 0]));
        const lista = productosParaReponer(
          p.data.flatMap((x: { id: number | null; nombre: string | null; tipo_venta: "peso" | "unidad" | null; stock_minimo: number | null }) =>
            x.id !== null && x.nombre !== null && x.tipo_venta !== null
              ? [{ id: x.id, nombre: x.nombre, tipoVenta: x.tipo_venta, stock: stockDe.get(x.id) ?? 0, stockMinimo: x.stock_minimo ?? 0 }]
              : [],
          ),
          15,
        );
        return ok({ cantidad: lista.length, productos: lista.map((x) => ({ nombre: x.nombre, estado: x.estado === "sin_stock" ? "sin stock" : "stock bajo", stock: formatearStock(x.stock, x.tipoVenta) })) });
      }

      case "vencimientos": {
        const dias = enteroEnRango(input.dias, 0, 60, 7);
        const { data, error } = await supabase.rpc("vencimientos_proximos", { p_dias: dias });
        const filas = error ? null : leerVencimientos(data);
        if (!filas) return sinDatos();
        return ok({
          ventana_dias: dias,
          cantidad: filas.length,
          lotes: filas.slice(0, 20).map((f) => ({ producto: f.nombre, quedan_aprox: formatearStock(f.quedan, f.tipo_venta), vence: f.vence_el, aviso: textoVencimiento(f.dias_restantes), urgencia: estadoVencimiento(f.dias_restantes) })),
        });
      }

      case "ganancia": {
        const dias = enteroEnRango(input.dias, 1, 90, 30);
        const { data, error } = await supabase.rpc("resumen_ganancia", { p_desde: restarDias(hoy, dias - 1), p_hasta: hoy });
        const fila = error ? null : leerResumenGanancia(data);
        if (!fila) return sinDatos();
        const g = calcularGanancia(fila);
        return ok({
          periodo_dias: dias,
          ganancia_estimada: formatearPesos(g.ganancia),
          margen_sobre_lo_vendido: g.margenPct === null ? "no se puede calcular" : `${g.margenPct} %`,
          parte_de_las_ventas_con_costo_cargado: g.coberturaPct === null ? "no hubo ventas" : `${g.coberturaPct} %`,
          ventas_sin_costo_cargado: formatearPesos(g.ingresosSinCosto),
          aclaracion: "Solo cuenta lo vendido que tiene costo cargado; es una estimación.",
        });
      }

      case "cuentas_a_pagar": {
        const [d, p, pr] = await Promise.all([
          supabase.from("lotes_stock").select("id, producto_id, proveedor_id, costo_total_centavos, pagar_hasta").eq("pagado", false).order("pagar_hasta", { ascending: true, nullsFirst: false }),
          supabase.from("productos").select("id, nombre"),
          supabase.from("proveedores").select("id, nombre"),
        ]);
        const deudas = d.error ? null : leerDeudas(d.data);
        if (!deudas || p.error || pr.error || !Array.isArray(p.data) || !Array.isArray(pr.data)) return sinDatos();
        const prod = new Map<number, string>(p.data.map((x: { id: number; nombre: string }) => [x.id, x.nombre]));
        const prov = new Map<number, string>(pr.data.map((x: { id: number; nombre: string }) => [x.id, x.nombre]));
        return ok({
          total_adeudado: formatearPesos(deudas.reduce((s, x) => s + x.costo_total_centavos, 0)),
          cantidad: deudas.length,
          compras: deudas.slice(0, 20).map((x) => ({
            proveedor: x.proveedor_id !== null ? (prov.get(x.proveedor_id) ?? "proveedor") : "sin proveedor",
            producto: prod.get(x.producto_id) ?? "producto",
            monto: formatearPesos(x.costo_total_centavos),
            pago: estadoDeuda(x.pagar_hasta, hoy).texto,
          })),
        });
      }

      case "meta_del_mes": {
        const [v, m] = await Promise.all([
          supabase.rpc("ventas_por_dia", { p_dias: diaDelMes(hoy) }),
          supabase.from("metas_mensuales").select("meta_centavos").eq("mes", primerDiaDelMes(hoy)).maybeSingle(),
        ]);
        const filas = v.error ? null : leerVentasPorDia(v.data);
        if (!filas || m.error || filas.length !== diaDelMes(hoy)) return sinDatos();
        const p = proyectarMes(hoy, filas.map((f) => f.total), m.data?.meta_centavos ?? null);
        return ok({
          meta: p.meta === null ? "todavía no definida (se define en Metas y gastos)" : formatearPesos(p.meta),
          vendido_en_el_mes: formatearPesos(p.vendido),
          avance: p.porcentajeAvance === null ? null : `${p.porcentajeAvance} %`,
          dias_restantes_hoy_incluido: p.diasRestantes,
          faltante: p.faltante === null ? null : formatearPesos(p.faltante),
          necesario_por_dia_desde_hoy: p.necesarioPorDia === null ? null : formatearPesos(p.necesarioPorDia),
          ritmo_diario_actual: p.ritmoDiario === null ? "todavía no hay un día completo" : formatearPesos(p.ritmoDiario),
          proyeccion_fin_de_mes: p.proyeccion === null ? null : formatearPesos(p.proyeccion),
          estado: p.estado,
          proyeccion_confiable: p.confiable,
        });
      }
    }
  } catch {
    return sinDatos();
  }
  return fallo("Herramienta no disponible.");
}
