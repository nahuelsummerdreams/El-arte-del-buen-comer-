import { describe, expect, test } from "vitest";
import {
  calcularGanancia,
  costoPorUnidadDeVenta,
  diasEntre,
  estadoDeuda,
  leerDeudas,
  estadoVencimiento,
  leerMargenPorProducto,
  leerMermas,
  leerResumenGanancia,
  leerVencimientos,
  margenDeProducto,
  textoVencimiento,
} from "@/lib/costos";

describe("costoPorUnidadDeVenta · lo que costó cada kilo o unidad", () => {
  test.each([
    [8_000_000, 10_000, "peso", 800_000], // $80.000 por 10 kg → $8.000 el kilo
    [5_000_000, 5_000, "peso", 1_000_000],
    [1_200_000, 24, "unidad", 50_000],
    [1000, 7, "unidad", 143], // 142,857 → 143 (redondea hacia arriba la mitad o más)
    [1, 2, "unidad", 1], // 0,5 → 1 (mitad hacia arriba)
    [1, 3, "unidad", 0], // 0,33 → 0
    [0, 5, "unidad", 0],
    [100, 1500, "peso", 67], // 66,67 por kilo → 67
  ] as const)("total %i por %i (%s) → %i", (total, cantidad, tipo, esperado) => {
    expect(costoPorUnidadDeVenta(total, cantidad, tipo)).toBe(esperado);
  });

  test("nunca devuelve algo que no entre en el sistema", () => {
    expect(costoPorUnidadDeVenta(2_000_000_000, 1, "peso")).toBeNull(); // $20 millones por 1 g
    expect(costoPorUnidadDeVenta(2_147_483_647, 1, "unidad")).toBe(2_147_483_647);
  });

  test.each([[-1, 5], [10, 0], [10, -3], [1.5, 2], [10, 2.5], [Number.NaN, 2]])("entradas inválidas (%s, %s) → null", (t, c) => {
    expect(costoPorUnidadDeVenta(t, c, "unidad")).toBeNull();
  });
});

describe("calcularGanancia", () => {
  const base = { ingresos_con_costo: 5_000_000, costo_vendido: 2_000_286, ingresos_sin_costo: 777_700, descuentos: 50_000 };

  test("ganancia = vendido con costo − costo − descuentos", () => {
    expect(calcularGanancia(base).ganancia).toBe(5_000_000 - 2_000_286 - 50_000);
  });

  test("margen sobre lo vendido neto de descuentos", () => {
    // ganancia 2.949.714 sobre 4.950.000 → 60 %
    expect(calcularGanancia(base).margenPct).toBe(60);
  });

  test("cobertura: qué parte de lo vendido tiene costo cargado", () => {
    expect(calcularGanancia(base).coberturaPct).toBe(87); // 5.000.000 / 5.777.700
    expect(calcularGanancia({ ...base, ingresos_sin_costo: 0 }).coberturaPct).toBe(100);
    expect(calcularGanancia({ ...base, ingresos_con_costo: 0, costo_vendido: 0 }).coberturaPct).toBe(0);
  });

  test("sin ventas no hay margen ni cobertura (no se inventa un 0 %)", () => {
    const g = calcularGanancia({ ingresos_con_costo: 0, costo_vendido: 0, ingresos_sin_costo: 0, descuentos: 0 });
    expect(g).toEqual({ ganancia: 0, margenPct: null, coberturaPct: null, ingresosSinCosto: 0 });
  });

  test("puede dar pérdida: se muestra negativa, no se esconde", () => {
    const g = calcularGanancia({ ingresos_con_costo: 1000, costo_vendido: 1500, ingresos_sin_costo: 0, descuentos: 0 });
    expect(g.ganancia).toBe(-500);
    expect(g.margenPct).toBe(-50);
  });

  test("descuentos mayores a lo vendido con costo: margen null", () => {
    expect(calcularGanancia({ ingresos_con_costo: 100, costo_vendido: 50, ingresos_sin_costo: 0, descuentos: 200 }).margenPct).toBeNull();
  });
});

describe("margenDeProducto", () => {
  test.each([
    [2_000_000, 1_000_000, 50],
    [1000, 1000, 0],
    [1000, 1500, -50],
    [1000, 0, 100],
    [3, 1, 67],
  ])("precio %i costo %i → %i %%", (p, c, esperado) => expect(margenDeProducto(p, c)).toBe(esperado));

  test("sin precio no hay margen", () => {
    expect(margenDeProducto(0, 100)).toBeNull();
    expect(margenDeProducto(-5, 100)).toBeNull();
  });
});

describe("lectura segura de lo que devuelve la base", () => {
  test("leerResumenGanancia exige UNA fila con enteros no negativos", () => {
    const f = { ingresos_con_costo: 1, costo_vendido: 2, ingresos_sin_costo: 3, descuentos: 4 };
    expect(leerResumenGanancia([f])).toEqual(f);
    expect(leerResumenGanancia([])).toBeNull();
    expect(leerResumenGanancia([f, f])).toBeNull();
    expect(leerResumenGanancia(null)).toBeNull();
    expect(leerResumenGanancia([{ ...f, costo_vendido: -1 }])).toBeNull();
    expect(leerResumenGanancia([{ ...f, descuentos: 1.5 }])).toBeNull();
    expect(leerResumenGanancia([{ ...f, descuentos: "4" }])).toBeNull();
  });

  const m = { producto_id: 1, nombre: "Jamón", tipo_venta: "peso", cantidad: 5, ingresos_con_costo: 10, costo_vendido: 4, ingresos_sin_costo: 0 };
  test("leerMargenPorProducto", () => {
    expect(leerMargenPorProducto([m])).toEqual([m]);
    expect(leerMargenPorProducto([{ ...m, tipo_venta: "litro" }])).toBeNull();
    expect(leerMargenPorProducto([{ ...m, nombre: 5 }])).toBeNull();
    expect(leerMargenPorProducto([{ ...m, costo_vendido: -1 }])).toBeNull();
  });

  const e = { producto_id: 1, nombre: "Jamón", tipo_venta: "peso", cantidad: 500, costo_centavos: 5000, sin_costo: 0 };
  test("leerMermas", () => {
    expect(leerMermas([e])).toEqual([e]);
    expect(leerMermas([{ ...e, cantidad: -1 }])).toBeNull();
    expect(leerMermas("x")).toBeNull();
  });

  const v = { lote_id: 1, producto_id: 2, nombre: "Queso", tipo_venta: "peso", quedan: 100, vence_el: "2026-10-14", dias_restantes: 5 };
  test("leerVencimientos acepta días negativos (ya venció) pero no fechas raras", () => {
    expect(leerVencimientos([v])).toEqual([v]);
    expect(leerVencimientos([{ ...v, dias_restantes: -2 }])).toHaveLength(1);
    expect(leerVencimientos([{ ...v, vence_el: "14/10" }])).toBeNull();
    expect(leerVencimientos([{ ...v, dias_restantes: 1.5 }])).toBeNull();
    expect(leerVencimientos([{ ...v, quedan: -1 }])).toBeNull();
  });
});

describe("vencimientos: estado y texto", () => {
  test.each([
    [-10, "vencido"], [-1, "vencido"], [0, "hoy"], [1, "urgente"], [3, "urgente"], [4, "proximo"], [60, "proximo"],
  ] as const)("%i días → %s", (d, e) => expect(estadoVencimiento(d)).toBe(e));

  test.each([
    [-5, "Venció hace 5 días"], [-2, "Venció hace 2 días"], [-1, "Venció ayer"], [0, "Vence hoy"], [1, "Vence mañana"], [2, "Vence en 2 días"], [30, "Vence en 30 días"],
  ])("%i → «%s»", (d, t) => expect(textoVencimiento(d)).toBe(t));
});

describe("cuentas a pagar", () => {
  test.each([
    ["2026-10-09", "2026-10-09", 0], ["2026-10-09", "2026-10-10", 1], ["2026-10-09", "2026-10-08", -1],
    ["2026-10-30", "2026-11-02", 3], ["2026-02-27", "2026-03-01", 2], ["2024-02-27", "2024-03-01", 3], ["2025-12-31", "2026-01-01", 1],
  ])("diasEntre(%s, %s) = %i", (a, b, n) => expect(diasEntre(a, b)).toBe(n));

  test("diasEntre rechaza fechas raras", () => {
    expect(() => diasEntre("hola", "2026-10-09")).toThrow();
    expect(() => diasEntre("2026-10-09", "9/10")).toThrow();
  });

  test.each([
    [null, "sin_fecha", "Sin fecha de pago"],
    ["2026-10-01", "vencida", "Debías pagarla hace 8 días"],
    ["2026-10-08", "vencida", "Debías pagarla ayer"],
    ["2026-10-09", "hoy", "Se paga hoy"],
    ["2026-10-10", "proxima", "Se paga mañana"],
    ["2026-10-20", "proxima", "Se paga en 11 días"],
  ])("estadoDeuda(%s)", (fecha, estado, texto) => {
    expect(estadoDeuda(fecha, "2026-10-09")).toEqual({ estado, texto });
  });

  const d = { id: 1, producto_id: 2, proveedor_id: 3, costo_total_centavos: 5000, pagar_hasta: "2026-10-20" };
  test("leerDeudas", () => {
    expect(leerDeudas([d])).toEqual([d]);
    expect(leerDeudas([{ ...d, proveedor_id: null, pagar_hasta: null }])).toHaveLength(1);
    expect(leerDeudas([{ ...d, pagar_hasta: "20/10" }])).toBeNull();
    expect(leerDeudas([{ ...d, costo_total_centavos: -1 }])).toBeNull();
    expect(leerDeudas([{ ...d, costo_total_centavos: null }])).toBeNull();
    expect(leerDeudas([{ ...d, proveedor_id: "x" }])).toBeNull();
  });
});
