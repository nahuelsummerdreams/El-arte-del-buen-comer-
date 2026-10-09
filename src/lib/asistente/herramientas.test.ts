import { describe, expect, test, vi } from "vitest";
import { ejecutarHerramienta, enteroEnRango, HERRAMIENTAS, limpiarBusqueda, type ClienteDatos } from "@/lib/asistente/herramientas";

/** Cliente de Supabase de mentira: cada tabla devuelve lo que le demos; cada rpc también. */
function falso({ tablas = {}, rpcs = {}, error = false }: { tablas?: Record<string, unknown>; rpcs?: Record<string, unknown>; error?: boolean } = {}) {
  const ilike = vi.fn();
  const rpc = vi.fn(async (nombre: string) => ({ data: rpcs[nombre] ?? null, error: error ? { message: "x" } : null }));
  const from = (tabla: string) => {
    const resultado = { data: tablas[tabla] ?? [], error: error ? { message: "x" } : null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {};
    for (const m of ["select", "eq", "order", "limit", "in", "is"]) q[m] = () => q;
    q.ilike = (...a: unknown[]) => { ilike(...a); return q; };
    q.maybeSingle = async () => ({ data: Array.isArray(resultado.data) ? (resultado.data[0] ?? null) : resultado.data, error: resultado.error });
    q.then = (res: (v: unknown) => unknown) => res(resultado);
    return q;
  };
  return { supabase: { from, rpc } as ClienteDatos, ilike, rpc };
}
const dueno = (supabase: ClienteDatos) => ({ supabase, rol: "dueno" as const, hoy: "2026-10-09" });
const cajero = (supabase: ClienteDatos) => ({ supabase, rol: "cajero" as const, hoy: "2026-10-09" });
const leer = (r: { texto: string }) => JSON.parse(r.texto);

describe("ayudas", () => {
  test.each([[5, 1, 31, 7, 5], [0, 1, 31, 7, 1], [99, 1, 31, 7, 31], [2.9, 1, 31, 7, 2], [-3, 1, 31, 7, 1], ["5", 1, 31, 7, 7], [undefined, 1, 31, 7, 7], [Number.NaN, 1, 31, 7, 7], [Infinity, 1, 31, 7, 7]])(
    "enteroEnRango(%s, %i, %i, %i) = %i",
    (v, min, max, def, esperado) => expect(enteroEnRango(v, min, max, def)).toBe(esperado),
  );

  test("limpiarBusqueda saca lo peligroso para un filtro", () => {
    expect(limpiarBusqueda("jamón cocido")).toBe("jamón cocido");
    expect(limpiarBusqueda("50%_off,(x)")).toBe("50 off x");
    expect(limpiarBusqueda("a".repeat(100))).toHaveLength(40);
    expect(limpiarBusqueda(null)).toBe("");
    expect(limpiarBusqueda(42)).toBe("");
    expect(limpiarBusqueda("  mucho   espacio ")).toBe("mucho espacio");
  });

  test("todas las herramientas tienen nombre único y esquema", () => {
    const nombres = HERRAMIENTAS.map((h) => h.name);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const h of HERRAMIENTAS) expect(h.input_schema.type).toBe("object");
  });
});

describe("seguridad", () => {
  test("herramienta inexistente", async () => {
    const r = await ejecutarHerramienta("borrar_todo", {}, dueno(falso().supabase));
    expect(r.esError).toBe(true);
  });

  test("el cajero NO puede pedir datos del dueño aunque el modelo los pida", async () => {
    const f = falso({ rpcs: { resumen_ganancia: [{ ingresos_con_costo: 1, costo_vendido: 1, ingresos_sin_costo: 0, descuentos: 0 }] } });
    for (const nombre of ["ventas_por_dia", "productos_mas_vendidos", "para_reponer", "vencimientos", "ganancia", "cuentas_a_pagar", "meta_del_mes"]) {
      const r = await ejecutarHerramienta(nombre, {}, cajero(f.supabase));
      expect(r.esError, nombre).toBe(true);
      expect(r.texto).toMatch(/solo para el dueño/);
    }
    expect(f.rpc).not.toHaveBeenCalled(); // ni siquiera se consultó la base
  });

  test("entradas absurdas no rompen nada", async () => {
    const f = falso({ rpcs: { ventas_por_dia: [] } });
    for (const entrada of [null, undefined, 5, "texto", [], { dias: "mil" }, { dias: -50 }]) {
      const r = await ejecutarHerramienta("ventas_por_dia", entrada, dueno(f.supabase));
      expect(typeof r.texto).toBe("string");
    }
  });

  test("si la base falla, se informa sin detalles internos", async () => {
    const r = await ejecutarHerramienta("ganancia", {}, dueno(falso({ error: true }).supabase));
    expect(r).toEqual({ texto: "No se pudieron leer los datos en este momento.", esError: true });
  });

  test("si la base devuelve algo raro, se rechaza (no se inventa)", async () => {
    const r = await ejecutarHerramienta("ventas_por_dia", {}, dueno(falso({ rpcs: { ventas_por_dia: [{ dia: "x", total: "mucho" }] } }).supabase));
    expect(r.esError).toBe(true);
  });

  test("una excepción inesperada se atrapa", async () => {
    const roto = { from: () => { throw new Error("boom"); }, rpc: () => { throw new Error("boom"); } } as ClienteDatos;
    expect((await ejecutarHerramienta("para_reponer", {}, dueno(roto))).esError).toBe(true);
  });
});

describe("stock_de_productos", () => {
  const tablas = {
    productos_con_precio: [
      { id: 1, nombre: "Jamón cocido", tipo_venta: "peso", precio_centavos: 2_000_000 },
      { id: 2, nombre: "Gaseosa 1.5L", tipo_venta: "unidad", precio_centavos: 250_000 },
      { id: 3, nombre: "Nuevo", tipo_venta: "unidad", precio_centavos: null },
    ],
    stock_actual: [{ producto_id: 1, stock: 2500 }, { producto_id: 2, stock: 0 }],
  };

  test("devuelve stock y precio ya formateados", async () => {
    const r = leer(await ejecutarHerramienta("stock_de_productos", {}, cajero(falso({ tablas }).supabase)));
    expect(r.productos[0]).toEqual({ nombre: "Jamón cocido", se_vende_por: "peso (kilos)", precio: "$ 20.000,00 el kilo", stock: "2,5 kg" });
    expect(r.productos[1]).toMatchObject({ precio: "$ 2.500,00 cada una", stock: "0 u." });
    expect(r.productos[2]).toMatchObject({ precio: "sin precio", stock: "0 u." }); // sin movimientos → 0
  });

  test("el filtro de nombre se limpia antes de usarse", async () => {
    const f = falso({ tablas });
    await ejecutarHerramienta("stock_de_productos", { buscar: "jam%ón,(x)" }, cajero(f.supabase));
    expect(f.ilike).toHaveBeenCalledWith("nombre", "%jam ón x%");
  });

  test("sin coincidencias lo dice", async () => {
    const r = leer(await ejecutarHerramienta("stock_de_productos", { buscar: "zzz" }, cajero(falso({ tablas: { productos_con_precio: [] } }).supabase)));
    expect(r.resultado).toMatch(/No hay productos/);
  });
});

describe("herramientas del dueño con datos", () => {
  test("ventas_por_dia: totales y ticket promedio formateados", async () => {
    const f = falso({ rpcs: { ventas_por_dia: [{ dia: "2026-10-08", cantidad: 2, total: 100_000, descuentos: 0 }, { dia: "2026-10-09", cantidad: 1, total: 50_000, descuentos: 5_000 }] } });
    const r = leer(await ejecutarHerramienta("ventas_por_dia", { dias: 2 }, dueno(f.supabase)));
    expect(f.rpc).toHaveBeenCalledWith("ventas_por_dia", { p_dias: 2 });
    expect(r).toMatchObject({ total_periodo: "$ 1.500,00", ventas_periodo: 3, ticket_promedio: "$ 500,00", desde: "2026-10-08", hasta: "2026-10-09" });
    expect(r.dias[1]).toEqual({ dia: "2026-10-09", ventas: 1, total: "$ 500,00", descuentos: "$ 50,00" });
  });

  test("productos_mas_vendidos usa el rango correcto", async () => {
    const f = falso({ rpcs: { productos_mas_vendidos: [{ producto_id: 1, nombre: "Jamón", tipo_venta: "peso", cantidad: 1500, ingresos: 3_000_000 }] } });
    const r = leer(await ejecutarHerramienta("productos_mas_vendidos", { dias: 7, limite: 3 }, dueno(f.supabase)));
    expect(f.rpc).toHaveBeenCalledWith("productos_mas_vendidos", { p_desde: "2026-10-03", p_hasta: "2026-10-09", p_limite: 3 });
    expect(r.ranking[0]).toEqual({ puesto: 1, producto: "Jamón", vendido: "1,5 kg", importe: "$ 30.000,00" });
  });

  test("para_reponer", async () => {
    const f = falso({ tablas: {
      productos_con_precio: [{ id: 1, nombre: "Queso", tipo_venta: "peso", stock_minimo: 0 }, { id: 2, nombre: "Agua", tipo_venta: "unidad", stock_minimo: 5 }, { id: 3, nombre: "Pan", tipo_venta: "unidad", stock_minimo: 0 }],
      stock_actual: [{ producto_id: 1, stock: -450 }, { producto_id: 2, stock: 3 }, { producto_id: 3, stock: 40 }],
    } });
    const r = leer(await ejecutarHerramienta("para_reponer", {}, dueno(f.supabase)));
    expect(r.cantidad).toBe(2);
    expect(r.productos).toEqual([{ nombre: "Queso", estado: "sin stock", stock: "-450 g" }, { nombre: "Agua", estado: "stock bajo", stock: "3 u." }]);
  });

  test("ganancia: con y sin costo", async () => {
    const con = falso({ rpcs: { resumen_ganancia: [{ ingresos_con_costo: 5_000_000, costo_vendido: 2_000_000, ingresos_sin_costo: 5_000_000, descuentos: 0 }] } });
    const r = leer(await ejecutarHerramienta("ganancia", {}, dueno(con.supabase)));
    expect(r).toMatchObject({ ganancia_estimada: "$ 30.000,00", margen_sobre_lo_vendido: "60 %", parte_de_las_ventas_con_costo_cargado: "50 %" });
    const sin = falso({ rpcs: { resumen_ganancia: [{ ingresos_con_costo: 0, costo_vendido: 0, ingresos_sin_costo: 0, descuentos: 0 }] } });
    expect(leer(await ejecutarHerramienta("ganancia", {}, dueno(sin.supabase)))).toMatchObject({ margen_sobre_lo_vendido: "no se puede calcular", parte_de_las_ventas_con_costo_cargado: "no hubo ventas" });
  });

  test("vencimientos", async () => {
    const f = falso({ rpcs: { vencimientos_proximos: [{ lote_id: 1, producto_id: 1, nombre: "Jamón", tipo_venta: "peso", quedan: 3200, vence_el: "2026-10-08", dias_restantes: -1 }] } });
    const r = leer(await ejecutarHerramienta("vencimientos", { dias: 3 }, dueno(f.supabase)));
    expect(f.rpc).toHaveBeenCalledWith("vencimientos_proximos", { p_dias: 3 });
    expect(r.lotes[0]).toMatchObject({ producto: "Jamón", quedan_aprox: "3,2 kg", aviso: "Venció ayer", urgencia: "vencido" });
  });

  test("cuentas_a_pagar", async () => {
    const f = falso({ tablas: {
      lotes_stock: [{ id: 1, producto_id: 1, proveedor_id: 7, costo_total_centavos: 5_000_000, pagar_hasta: "2026-10-07" }, { id: 2, producto_id: 2, proveedor_id: null, costo_total_centavos: 1_000_000, pagar_hasta: null }],
      productos: [{ id: 1, nombre: "Jamón" }, { id: 2, nombre: "Gaseosa" }],
      proveedores: [{ id: 7, nombre: "Frigorífico Sur" }],
    } });
    const r = leer(await ejecutarHerramienta("cuentas_a_pagar", {}, dueno(f.supabase)));
    expect(r.total_adeudado).toBe("$ 60.000,00");
    expect(r.compras[0]).toEqual({ proveedor: "Frigorífico Sur", producto: "Jamón", monto: "$ 50.000,00", pago: "Debías pagarla hace 2 días" });
    expect(r.compras[1].proveedor).toBe("sin proveedor");
  });

  test("meta_del_mes", async () => {
    const dias = Array.from({ length: 9 }, (_, i) => ({ dia: `2026-10-0${i + 1}`, cantidad: 1, total: 100_000, descuentos: 0 }));
    const f = falso({ rpcs: { ventas_por_dia: dias }, tablas: { metas_mensuales: [{ meta_centavos: 40_000_000 }] } });
    const r = leer(await ejecutarHerramienta("meta_del_mes", {}, dueno(f.supabase)));
    expect(f.rpc).toHaveBeenCalledWith("ventas_por_dia", { p_dias: 9 });
    expect(r).toMatchObject({ meta: "$ 400.000,00", vendido_en_el_mes: "$ 9.000,00", dias_restantes_hoy_incluido: 23, estado: "atrasado" });
  });

  test("meta_del_mes sin meta definida", async () => {
    const dias = Array.from({ length: 9 }, (_, i) => ({ dia: `2026-10-0${i + 1}`, cantidad: 0, total: 0, descuentos: 0 }));
    const r = leer(await ejecutarHerramienta("meta_del_mes", {}, dueno(falso({ rpcs: { ventas_por_dia: dias } }).supabase)));
    expect(r.meta).toMatch(/todavía no definida/);
    expect(r.estado).toBe("sin_meta");
  });
});
