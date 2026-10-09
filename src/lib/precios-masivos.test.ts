import { describe, expect, test } from "vitest";
import { armarCambios, calcularPrecioNuevo, leerPorcentaje } from "@/lib/precios-masivos";

describe("leerPorcentaje", () => {
  test.each([["8", 800], ["8,5", 850], ["8,25", 825], ["-3", -300], ["+10", 1000], ["12 %", 1200], [" 5 ", 500], ["0,5", 50], ["300", 30000], ["-90", -9000]])(
    "«%s» → %i",
    (t, p) => expect(leerPorcentaje(t)).toEqual({ ok: true, puntosBasicos: p }),
  );

  test("el punto decimal se rechaza con explicación (igual que las cantidades)", () => {
    const r = leerPorcentaje("8.5");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("coma");
  });

  test.each([[""], ["  "], ["abc"], ["0"], ["0,00"], ["301"], ["-91"], ["8,123"], ["8,"], ["--5"], ["1e3"]])("«%s» se rechaza", (t) => {
    expect(leerPorcentaje(t).ok).toBe(false);
  });
});

describe("calcularPrecioNuevo", () => {
  test.each([
    [2_000_000, 1000, 1, 2_200_000], // $20.000 + 10 % = $22.000
    [1_999_900, 800, 10, 2_160_000], // $19.999 + 8 % = 21.598,92 → a los $10 → $21.600
    [1_999_900, 800, 1, 2_159_900], // 21.598,92 → al peso → $21.599
    [1_999_900, 800, 100, 2_160_000], // → a los $100 → $21.600
    [2_000_000, -1000, 1, 1_800_000],
  ] as const)("%i centavos %i pb redondeo %i → %i", (actual, pb, red, esperado) => {
    expect(calcularPrecioNuevo(actual, pb, red)).toBe(esperado);
  });

  test("redondeo: mitad hacia arriba", () => {
    // $100,50 + 1 % = $101,505 → al peso = $102 (mitad exacta no hay: 101,505 → 102)
    expect(calcularPrecioNuevo(10_050, 100, 1)).toBe(10_200);
    // exactamente la mitad: $5 + 10 % = $5,50 → al peso → $6
    expect(calcularPrecioNuevo(500, 1000, 1)).toBe(600);
    // $1.025 al $10: 102,5 escalones → 103 escalones = $1.030
    expect(calcularPrecioNuevo(102_500, 0, 10)).toBe(103_000);
  });

  test("un precio positivo nunca queda en cero", () => {
    expect(calcularPrecioNuevo(100, -9000, 100)).toBe(10_000);
    expect(calcularPrecioNuevo(100, -9000, 1)).toBe(100); // $1 −90 % = $0,10 → mínimo un escalón de $1
  });

  test("un precio en cero sigue en cero", () => {
    expect(calcularPrecioNuevo(0, 1000, 1)).toBe(0);
  });

  test("lo que no entra en el sistema devuelve null", () => {
    expect(calcularPrecioNuevo(2_000_000_000, 30000, 1)).toBeNull();
    expect(calcularPrecioNuevo(2_147_483_647, 100, 1)).toBeNull();
  });

  test.each([[-1, 100], [1.5, 100], [100, 1.5], [Number.NaN, 100], [100, -10_000], [100, -20_000]])(
    "entradas inválidas (%s, %s) → null",
    (a, p) => expect(calcularPrecioNuevo(a, p, 1)).toBeNull(),
  );

  test("bajar y subir el mismo porcentaje no vuelve exacto (por eso hay vista previa)", () => {
    const sube = calcularPrecioNuevo(1_999_900, 1000, 1)!;
    expect(calcularPrecioNuevo(sube, -1000, 1)).not.toBe(1_999_900);
  });
});

describe("armarCambios", () => {
  const productos = [
    { id: 1, nombre: "Jamón", categoriaId: 1, precio: 2_000_000 },
    { id: 2, nombre: "Queso", categoriaId: 2, precio: 1_000_000 },
    { id: 3, nombre: "Gaseosa", categoriaId: 4, precio: 500_000 },
    { id: 4, nombre: "Agua", categoriaId: 4, precio: 0 },
  ];

  test("todas las categorías", () => {
    const r = armarCambios(productos, { categoriaId: null, puntosBasicos: 1000, redondeo: 1 });
    expect(r.cambios.map((c) => [c.nombre, c.anterior, c.nuevo])).toEqual([
      ["Gaseosa", 500_000, 550_000],
      ["Jamón", 2_000_000, 2_200_000],
      ["Queso", 1_000_000, 1_100_000],
    ]);
    expect(r.sinCambio).toBe(1); // Agua, que está en cero
    expect(r.fueraDeRango).toEqual([]);
  });

  test("solo una categoría", () => {
    const r = armarCambios(productos, { categoriaId: 4, puntosBasicos: 1000, redondeo: 1 });
    expect(r.cambios.map((c) => c.id)).toEqual([3]);
  });

  test("categoría sin productos → nada que cambiar", () => {
    expect(armarCambios(productos, { categoriaId: 99, puntosBasicos: 1000, redondeo: 1 })).toEqual({ cambios: [], sinCambio: 0, fueraDeRango: [] });
  });

  test("un redondeo grande puede dejar precios igual: se cuentan, no se cambian", () => {
    const r = armarCambios([{ id: 1, nombre: "A", categoriaId: 1, precio: 1_000_000 }], { categoriaId: null, puntosBasicos: 30, redondeo: 100 }); // +0,3 % = $10.030 → a los $100 sigue en $10.000
    expect(r.cambios).toEqual([]);
    expect(r.sinCambio).toBe(1);
  });

  test("avisa de los productos cuyo precio nuevo no entra en el sistema", () => {
    const r = armarCambios([{ id: 1, nombre: "Enorme", categoriaId: 1, precio: 2_147_483_000 }], { categoriaId: null, puntosBasicos: 5000, redondeo: 1 });
    expect(r.fueraDeRango).toEqual(["Enorme"]);
    expect(r.cambios).toEqual([]);
  });
});
