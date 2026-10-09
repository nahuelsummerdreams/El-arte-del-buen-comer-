import { describe, expect, test } from "vitest";
import {
  abreviarPesos,
  escalaLimpia,
  iniciales,
  escalarBarras,
  etiquetaDiaCorta,
  etiquetaDiaLarga,
  leerMasVendidos,
  leerVentasPorDia,
  leerVentasPorMedio,
  productosParaReponer,
  restarDias,
  ticketPromedio,
  variacionPorcentual,
} from "@/lib/panel";

describe("variacionPorcentual · contra el período anterior", () => {
  test.each([
    [150, 100, 50],
    [50, 100, -50],
    [100, 100, 0],
    [1, 3, -67], // redondea al entero más cercano
    [2, 3, -33],
    [1000, 100, 900],
    [0, 100, -100],
  ])("%i contra %i → %i%%", (actual, anterior, esperado) => {
    expect(variacionPorcentual(actual, anterior)).toBe(esperado);
  });

  test.each([["anterior cero", 5, 0], ["anterior negativo", 5, -1]])(
    "no hay variación posible si el período anterior no tuvo ventas (%s) → null",
    (_n, actual, anterior) => expect(variacionPorcentual(actual, anterior)).toBeNull(),
  );
});

describe("ticketPromedio", () => {
  test.each([
    [3_000_000, 3, 1_000_000],
    [1000, 3, 333],
    [5, 2, 3], // el medio sube
    [0, 5, 0],
  ])("%i centavos en %i ventas → %i", (total, cantidad, esperado) => {
    expect(ticketPromedio(total, cantidad)).toBe(esperado);
  });

  test("sin ventas el ticket promedio es 0 (nunca NaN ni Infinity)", () => {
    expect(ticketPromedio(0, 0)).toBe(0);
    expect(ticketPromedio(1000, 0)).toBe(0);
  });
});

describe("abreviarPesos · para ejes y tarjetas chicas (recibe CENTAVOS)", () => {
  test.each([
    [0, "$ 0"],
    [95_000, "$ 950"],
    [99_949, "$ 999"],
    [100_000, "$ 1 mil"],
    [4_480_000, "$ 44,8 mil"],
    [4_500_000, "$ 45 mil"],
    [99_900_000, "$ 999 mil"],
    [100_000_000, "$ 1 M"],
    [123_000_000, "$ 1,2 M"],
    [2_500_000_000, "$ 25 M"],
    [99_995_000, "$ 1 M"], // 999,95 mil se redondea a 1.000 mil → mejor "1 M"
    [-4_480_000, "-$ 44,8 mil"],
  ])("%i centavos → «%s»", (centavos, esperado) => {
    expect(abreviarPesos(centavos)).toBe(esperado);
  });
});

describe("escalarBarras · alturas proporcionales", () => {
  test("la mayor ocupa toda la altura y el resto es proporcional", () => {
    expect(escalarBarras([0, 50, 100], 100)).toEqual([0, 50, 100]);
  });

  test("un valor positivo nunca desaparece: se dibuja al menos 2 px", () => {
    expect(escalarBarras([1, 1000], 100)).toEqual([2, 100]);
  });

  test("el cero se queda en cero", () => expect(escalarBarras([0, 10], 80)).toEqual([0, 80]));
  test("todos ceros → todos ceros (no divide por cero)", () => expect(escalarBarras([0, 0, 0], 50)).toEqual([0, 0, 0]));
  test("lista vacía", () => expect(escalarBarras([], 50)).toEqual([]));

  test("redondea a 2 decimales", () => {
    expect(escalarBarras([1, 3], 10)[0]).toBe(3.33);
  });

  test("un valor negativo se trata como cero (no hay ventas negativas)", () => {
    expect(escalarBarras([-5, 10], 100)).toEqual([0, 100]);
  });
});

describe("fechas de calendario (AAAA-MM-DD, sin zona horaria)", () => {
  test("etiquetaDiaCorta", () => {
    expect(etiquetaDiaCorta("2026-10-09")).toBe("vie 9");
    expect(etiquetaDiaCorta("2026-10-05")).toBe("lun 5");
    expect(etiquetaDiaCorta("2026-10-07")).toBe("mié 7");
  });

  test("etiquetaDiaLarga (sin la coma de Intl)", () => {
    expect(etiquetaDiaLarga("2026-10-09")).toBe("viernes 9 de octubre");
    expect(etiquetaDiaLarga("2026-01-01")).toBe("jueves 1 de enero");
  });

  test.each([["texto", "hola"], ["vacío", ""], ["fecha imposible", "2026-02-30"], ["mes 13", "2026-13-01"], ["con hora", "2026-10-09T10:00"]])(
    "fecha inválida: %s",
    (_n, v) => {
      expect(() => etiquetaDiaCorta(v)).toThrow();
      expect(() => etiquetaDiaLarga(v)).toThrow();
      expect(() => restarDias(v, 1)).toThrow();
    },
  );

  test("restarDias cruza meses y años", () => {
    expect(restarDias("2026-10-09", 6)).toBe("2026-10-03");
    expect(restarDias("2026-03-02", 3)).toBe("2026-02-27");
    expect(restarDias("2026-01-01", 1)).toBe("2025-12-31");
    expect(restarDias("2024-03-01", 1)).toBe("2024-02-29"); // año bisiesto
    expect(restarDias("2026-10-09", 0)).toBe("2026-10-09");
  });
});

describe("lectura segura de lo que devuelve la base", () => {
  const dia = { dia: "2026-10-09", cantidad: 3, total: 1_550_000, descuentos: 50_000 };

  test("leerVentasPorDia acepta filas válidas", () => {
    expect(leerVentasPorDia([dia])).toEqual([dia]);
    expect(leerVentasPorDia([])).toEqual([]);
  });

  test.each([
    ["no es lista", { dia }],
    ["null", null],
    ["fecha mala", [{ ...dia, dia: "9/10" }]],
    ["total decimal", [{ ...dia, total: 1.5 }]],
    ["total texto", [{ ...dia, total: "5" }]],
    ["falta un campo", [{ dia: "2026-10-09", cantidad: 1, total: 1 }]],
    ["una fila nula", [dia, null]],
  ])("leerVentasPorDia rechaza: %s", (_n, v) => expect(leerVentasPorDia(v)).toBeNull());

  test("leerVentasPorMedio conserva solo medios conocidos", () => {
    const filas = [{ medio: "efectivo", cantidad: 2, total: 100 }, { medio: "tarjeta", cantidad: 1, total: 50 }];
    expect(leerVentasPorMedio(filas)).toEqual(filas);
    expect(leerVentasPorMedio([{ medio: "cheque", cantidad: 1, total: 1 }])).toBeNull();
    expect(leerVentasPorMedio("x")).toBeNull();
  });

  test("leerMasVendidos", () => {
    const fila = { producto_id: 1, nombre: "Jamón", tipo_venta: "peso", cantidad: 520, ingresos: 1040 };
    expect(leerMasVendidos([fila])).toEqual([fila]);
    expect(leerMasVendidos([{ ...fila, tipo_venta: "litro" }])).toBeNull();
    expect(leerMasVendidos([{ ...fila, nombre: 5 }])).toBeNull();
    expect(leerMasVendidos([{ ...fila, cantidad: -1 }])).toBeNull();
  });
});

describe("productosParaReponer", () => {
  const p = (id: number, nombre: string, stock: number, stockMinimo = 0) => ({
    id, nombre, tipoVenta: "unidad" as const, stock, stockMinimo,
  });

  test("incluye lo que está en cero o negativo, aunque no haya mínimo cargado", () => {
    const r = productosParaReponer([p(1, "A", 0), p(2, "B", -3), p(3, "C", 10)], 10);
    expect(r.map((x) => x.id)).toEqual([2, 1]);
  });

  test("incluye lo que llegó al mínimo o quedó por debajo, y distingue el estado", () => {
    const r = productosParaReponer([p(1, "A", 5, 5), p(2, "B", 4, 5), p(3, "C", 6, 5), p(4, "D", 0, 5)], 10);
    expect(r.map((x) => [x.id, x.estado])).toEqual([[4, "sin_stock"], [2, "bajo"], [1, "bajo"]]);
  });

  test("ordena de más urgente a menos (stock menor primero) y desempata por nombre", () => {
    const r = productosParaReponer([p(1, "Zeta", 0), p(2, "Alfa", 0), p(3, "Medio", -1)], 10);
    expect(r.map((x) => x.nombre)).toEqual(["Medio", "Alfa", "Zeta"]);
  });

  test("respeta el límite", () => {
    const todos = Array.from({ length: 20 }, (_, i) => p(i + 1, `P${i}`, 0));
    expect(productosParaReponer(todos, 5)).toHaveLength(5);
  });

  test("sin productos para reponer → lista vacía", () => {
    expect(productosParaReponer([p(1, "A", 50, 10)], 10)).toEqual([]);
  });
});

describe("escalaLimpia · eje vertical con números redondos (todo en centavos)", () => {
  test.each([
    [1_750_018, 2_000_000], //   $17.500 → eje hasta $20.000
    [2_000_000, 2_000_000], //   justo en un número redondo: no se agranda
    [2_000_001, 2_500_000],
    [2_400_000, 2_500_000],
    [3_000_000, 5_000_000],
    [5_000_000, 5_000_000],
    [5_000_001, 10_000_000],
    [10_000_000, 10_000_000],
    [9_999, 10_000],
    [1, 1],
    [123_456_789, 200_000_000],
  ])("máximo %i → el eje llega a %i", (maximo, esperado) => {
    expect(escalaLimpia(maximo).max).toBe(esperado);
  });

  test("sin ventas: eje por defecto de $100 (no queda vacío ni divide por cero)", () => {
    expect(escalaLimpia(0).max).toBe(10_000);
    expect(escalaLimpia(-5).max).toBe(10_000);
  });

  test("5 marcas parejas, de 0 al máximo", () => {
    expect(escalaLimpia(1_750_018).ticks).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
  });

  test("el eje SIEMPRE alcanza al valor máximo (ninguna barra se sale)", () => {
    for (const v of [1, 7, 99, 100, 101, 999, 1000, 4999, 5001, 12_345, 987_654, 3_333_333]) {
      const { max, ticks } = escalaLimpia(v);
      expect(max).toBeGreaterThanOrEqual(v);
      expect(ticks[ticks.length - 1]).toBe(max);
    }
  });
});

describe("iniciales · para el avatar", () => {
  test.each([
    ["Nicolás Maciel", "NM"],
    ["nicolás maciel", "NM"],
    ["Dueño", "D"],
    ["  María   José  García ", "MJ"], // solo las dos primeras palabras
    ["Álvaro", "Á"],
    ["", "?"],
    ["   ", "?"],
  ])("«%s» → «%s»", (nombre, esperado) => expect(iniciales(nombre)).toBe(esperado));
});
