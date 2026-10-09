import { describe, expect, test } from "vitest";
import {
  calcularSubtotal,
  calcularTotal,
  formatearCantidad,
  formatearPesos,
} from "@/lib/precios";

// Intl usa un espacio "no separable" (U+00A0) entre $ y el número.
// Lo normalizamos para que el test sea legible.
const normalizar = (s: string) => s.replace(/ /g, " ");

describe("calcularSubtotal · productos por peso (cantidad en gramos, precio por kg)", () => {
  test("250 g a $20.000 el kilo cuestan $5.000", () => {
    expect(calcularSubtotal({ cantidad: 250, precioCentavos: 2_000_000, tipoVenta: "peso" })).toBe(500_000);
  });

  test("1000 g cuestan exactamente el precio del kilo", () => {
    expect(calcularSubtotal({ cantidad: 1000, precioCentavos: 2_000_000, tipoVenta: "peso" })).toBe(2_000_000);
  });

  test("1 g es exacto cuando el precio es múltiplo de 1000", () => {
    expect(calcularSubtotal({ cantidad: 1, precioCentavos: 2_000_000, tipoVenta: "peso" })).toBe(2000);
  });

  test("redondea al centavo más cercano (333 g a $19.999,99 el kilo = $6.659,997 → $6.660,00)", () => {
    expect(calcularSubtotal({ cantidad: 333, precioCentavos: 1_999_999, tipoVenta: "peso" })).toBe(666_000);
  });

  test("el medio centavo exacto sube (0,5 → 1) y menos de medio baja (0,499 → 0)", () => {
    expect(calcularSubtotal({ cantidad: 1, precioCentavos: 500, tipoVenta: "peso" })).toBe(1);
    expect(calcularSubtotal({ cantidad: 1, precioCentavos: 499, tipoVenta: "peso" })).toBe(0);
  });

  test("más de un kilo: 1250 g a $18.500 el kilo = $23.125", () => {
    expect(calcularSubtotal({ cantidad: 1250, precioCentavos: 1_850_000, tipoVenta: "peso" })).toBe(2_312_500);
  });
});

describe("calcularSubtotal · productos por unidad", () => {
  test("3 unidades a $3.500 cuestan $10.500", () => {
    expect(calcularSubtotal({ cantidad: 3, precioCentavos: 350_000, tipoVenta: "unidad" })).toBe(1_050_000);
  });

  test("el precio de la unidad NO se divide por 1000", () => {
    expect(calcularSubtotal({ cantidad: 1, precioCentavos: 350_000, tipoVenta: "unidad" })).toBe(350_000);
  });
});

describe("calcularSubtotal · precio cero (promo / producto de regalo)", () => {
  test("es válido y da 0", () => {
    expect(calcularSubtotal({ cantidad: 2, precioCentavos: 0, tipoVenta: "unidad" })).toBe(0);
  });
});

describe("calcularSubtotal · entradas inválidas se rechazan con error", () => {
  const base = { cantidad: 250, precioCentavos: 2_000_000, tipoVenta: "peso" as const };

  test.each([
    ["cantidad cero", { cantidad: 0 }],
    ["cantidad negativa", { cantidad: -250 }],
    ["cantidad con decimales (se usan gramos enteros)", { cantidad: 250.5 }],
    ["cantidad NaN", { cantidad: Number.NaN }],
    ["cantidad infinita", { cantidad: Number.POSITIVE_INFINITY }],
    ["precio negativo", { precioCentavos: -1 }],
    ["precio con decimales (se usan centavos enteros)", { precioCentavos: 19.99 }],
    ["precio NaN", { precioCentavos: Number.NaN }],
  ])("%s", (_nombre, cambio) => {
    expect(() => calcularSubtotal({ ...base, ...cambio })).toThrow();
  });

  test("un resultado que no cabe de forma segura en un entero también se rechaza", () => {
    expect(() =>
      calcularSubtotal({ cantidad: Number.MAX_SAFE_INTEGER, precioCentavos: 2, tipoVenta: "unidad" }),
    ).toThrow();
  });
});

describe("calcularSubtotal · coincide con un cálculo exacto independiente", () => {
  test("5.000 combinaciones pseudoaleatorias (siempre las mismas) contra BigInt", () => {
    // Generador congruencial: da números "al azar" pero determinista, así el test nunca es inestable.
    let semilla = 12345;
    const siguiente = (maximo: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla % maximo;
    };

    for (let i = 0; i < 5000; i++) {
      const gramos = siguiente(50_000) + 1; // hasta 50 kg
      const precio = siguiente(10_000_000); // hasta $100.000 el kilo
      // Cálculo exacto con BigInt (enteros sin límite). Se escribe BigInt(500) y no 500n
      // porque el tsconfig del proyecto apunta a ES2017, que no admite esa notación.
      const esperado = Number((BigInt(gramos) * BigInt(precio) + BigInt(500)) / BigInt(1000)); // "redondeo comercial" exacto
      const obtenido = calcularSubtotal({ cantidad: gramos, precioCentavos: precio, tipoVenta: "peso" });
      expect(obtenido, `${gramos} g a ${precio} c/kg`).toBe(esperado);
    }
  });
});

describe("calcularTotal", () => {
  test("suma los subtotales de cada línea", () => {
    const total = calcularTotal([
      { cantidad: 250, precioCentavos: 2_000_000, tipoVenta: "peso" }, //   $5.000,00
      { cantidad: 3, precioCentavos: 350_000, tipoVenta: "unidad" }, //    $10.500,00
      { cantidad: 100, precioCentavos: 1_850_000, tipoVenta: "peso" }, //   $1.850,00
    ]);
    expect(total).toBe(500_000 + 1_050_000 + 185_000);
  });

  test("un carrito vacío vale 0", () => {
    expect(calcularTotal([])).toBe(0);
  });

  test("redondea cada línea por separado, como el ticket que ve el cliente", () => {
    // 3 líneas de 1 g a $0,0005... cada una redondea a 1 centavo (0,5 → 1): total 3, no 1,5 → 2.
    const linea = { cantidad: 1, precioCentavos: 500, tipoVenta: "peso" as const };
    expect(calcularTotal([linea, linea, linea])).toBe(3);
  });

  test("si una línea es inválida, falla todo el total (no cobra a medias)", () => {
    expect(() =>
      calcularTotal([
        { cantidad: 250, precioCentavos: 2_000_000, tipoVenta: "peso" },
        { cantidad: -1, precioCentavos: 2_000_000, tipoVenta: "peso" },
      ]),
    ).toThrow();
  });
});

describe("formatearPesos", () => {
  test.each([
    [500_000, "$ 5.000,00"],
    [2_000_000, "$ 20.000,00"],
    [0, "$ 0,00"],
    [1, "$ 0,01"],
    [123_456_789, "$ 1.234.567,89"],
    [-500, "-$ 5,00"],
  ])("%i centavos se muestran como %s", (centavos, esperado) => {
    expect(normalizar(formatearPesos(centavos))).toBe(esperado);
  });

  test("rechaza centavos con decimales", () => {
    expect(() => formatearPesos(10.5)).toThrow();
  });
});

describe("formatearCantidad", () => {
  test.each([
    [250, "peso", "250 g"],
    [999, "peso", "999 g"],
    [1000, "peso", "1 kg"],
    [1250, "peso", "1,25 kg"],
    [1500, "peso", "1,5 kg"],
    [12_345, "peso", "12,345 kg"],
    [1, "unidad", "1 u."],
    [12, "unidad", "12 u."],
  ] as const)("%i (%s) se muestra como %s", (cantidad, tipoVenta, esperado) => {
    expect(formatearCantidad(cantidad, tipoVenta)).toBe(esperado);
  });
});
