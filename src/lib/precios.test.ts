import { describe, expect, test } from "vitest";
import {
  calcularSubtotal,
  calcularTotal,
  centavosATextoEditable,
  formatearCantidad,
  formatearPesos,
  MAX_CENTAVOS,
  pesosACentavos,
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

describe("pesosACentavos · acepta el formato argentino", () => {
  test.each([
    ["20000", 2_000_000],
    ["20000,5", 2_000_050],
    ["20000,50", 2_000_050],
    ["20.000,50", 2_000_050],
    ["1.234.567,89", 123_456_789],
    ["$ 20.000,50", 2_000_050],
    ["$20.000", 2_000_000],
    ["  350  ", 35_000],
    ["0,05", 5],
    ["0", 0],
    ["007", 700],
    [" $ 1.500,00 ", 150_000], // espacios "no separables", como los que genera Intl
  ])("«%s» → %i centavos", (texto, esperado) => {
    expect(pesosACentavos(texto)).toBe(esperado);
  });
});

describe("pesosACentavos · el punto: miles o decimales", () => {
  test.each([
    ["20.500", 2_050_000], //  grupos de exactamente 3 dígitos = miles
    ["1.500", 150_000],
    ["12.345.678", 1_234_567_800],
    ["20.5", 2050], //         1 o 2 dígitos tras el punto = decimales (estilo inglés)
    ["20.50", 2050],
    ["1.23", 123], //         dos dígitos tras el punto: decimales, no miles mal puestos
  ])("«%s» → %i centavos", (texto, esperado) => {
    expect(pesosACentavos(texto)).toBe(esperado);
  });
});

describe("pesosACentavos · rechaza lo ambiguo o inválido", () => {
  test.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["solo el signo", "$"],
    ["negativo", "-5"],
    ["letras", "abc"],
    ["letras mezcladas", "20x00"],
    ["tres decimales con coma", "10,999"],
    ["cuatro dígitos tras el punto (ni miles ni decimales)", "10.9999"],
    ["formato inglés con coma de miles", "1,000.50"],
    ["dos comas", "1,5,5"],
    ["coma sin decimales", "20,"],
    ["coma sin parte entera", ",50"],
    ["puntos mal agrupados", "1.23.456"],
    ["varios puntos decimales", "1.2.3"],
    ["símbolo en el medio", "20$00"],
    ["notación científica", "1e5"],
    ["fracción", "1/2"],
  ])("%s: «%s»", (_nombre, texto) => {
    expect(() => pesosACentavos(texto)).toThrow();
  });

  test("rechaza un precio mayor a lo que entra en la base de datos (entero de 32 bits)", () => {
    expect(pesosACentavos("21.474.836,47")).toBe(MAX_CENTAVOS); // el máximo exacto sí entra
    expect(() => pesosACentavos("21.474.836,48")).toThrow(); //     un centavo más, no
    expect(() => pesosACentavos("99999999999999999999")).toThrow(); // cifras absurdas
  });

  test("MAX_CENTAVOS es el máximo de un integer de PostgreSQL", () => {
    expect(MAX_CENTAVOS).toBe(2_147_483_647);
  });
});

describe("centavosATextoEditable · para precargar un campo al editar", () => {
  test.each([
    [2_000_050, "20000,50"],
    [500_000, "5000,00"],
    [0, "0,00"],
    [5, "0,05"],
    [150_000, "1500,00"],
  ])("%i → «%s»", (centavos, esperado) => {
    expect(centavosATextoEditable(centavos)).toBe(esperado);
  });

  test("rechaza negativos y decimales", () => {
    expect(() => centavosATextoEditable(-1)).toThrow();
    expect(() => centavosATextoEditable(1.5)).toThrow();
  });

  test("ida y vuelta: convertir a texto y volver da el mismo número (3.000 casos)", () => {
    let semilla = 777;
    for (let i = 0; i < 3000; i++) {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      const centavos = semilla % (MAX_CENTAVOS + 1);
      expect(pesosACentavos(centavosATextoEditable(centavos))).toBe(centavos);
    }
  });
});
