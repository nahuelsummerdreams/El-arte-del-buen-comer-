import { describe, expect, test } from "vitest";
import type { FilaVencimiento } from "@/lib/costos";
import { armarOfertas, descuentoSugerido, DESCUENTOS, esDescuentoValido, margenDeOferta, precioAnteriorDeOferta, precioConOferta, textoCartel } from "@/lib/ofertas";

describe("descuentoSugerido", () => {
  test.each([[0, 50], [1, 40], [2, 30], [3, 30], [4, 20], [7, 20], [8, 10], [14, 10]] as const)("%i días → %i %%", (d, p) => expect(descuentoSugerido(d)).toBe(p));
  test.each([[-1], [-30], [15], [90], [Number.NaN], [Infinity]])("%s → sin oferta", (d) => expect(descuentoSugerido(d)).toBeNull());
  test("más cerca del vencimiento, nunca menos descuento", () => {
    let anterior = 100;
    for (let d = 0; d <= 14; d++) {
      const p = descuentoSugerido(d)!;
      expect(p).toBeLessThanOrEqual(anterior);
      anterior = p;
    }
  });
});

describe("esDescuentoValido (lo que llega del navegador)", () => {
  test.each(DESCUENTOS.map((d) => [d]))("%i sí", (d) => expect(esDescuentoValido(d)).toBe(true));
  test.each([[0], [5], [99], [100], [-10], [10.5], ["10"], [null], [undefined], [Number.NaN]])("%j no", (d) => expect(esDescuentoValido(d)).toBe(false));
});

describe("precioConOferta", () => {
  test.each([
    [1_980_000, 20, 1_584_000], // $ 19.800 −20 % = $ 15.840
    [1_980_000, 30, 1_386_000], // $ 13.860
    [1_999_900, 50, 1_000_000], // $ 9.999,50 → a los $ 10 más cercanos: $ 10.000
    [250_000, 10, 225_000], // $ 2.250
    [10_000, 50, 5_000], // $ 50 → $ 25
  ] as const)("%i centavos −%i %% → %i", (p, d, esperado) => expect(precioConOferta(p, d)).toBe(esperado));
  test("el precio de oferta siempre es menor que el normal (para precios normales)", () => {
    for (const d of DESCUENTOS) expect(precioConOferta(1_980_000, d)!).toBeLessThan(1_980_000);
  });
  test("exactos", () => {
    expect(precioConOferta(1_000_000, 20)).toBe(800_000);
    expect(precioConOferta(1_000_000, 50)).toBe(500_000);
    expect(precioConOferta(1_234_500, 10)).toBe(1_111_000); // 11.110,50 → $11.110 (a los $10)
  });
  test("no queda en cero", () => expect(precioConOferta(500, 50)).toBeGreaterThan(0));
});

describe("margenDeOferta", () => {
  test("con margen", () => expect(margenDeOferta(1_580_000, 1_350_000)).toEqual({ margenPct: 15, pierde: false }));
  test("justo en el costo", () => expect(margenDeOferta(1_000_000, 1_000_000)).toEqual({ margenPct: 0, pierde: false }));
  test("por debajo del costo: pierde", () => expect(margenDeOferta(900_000, 1_000_000)).toEqual({ margenPct: -11, pierde: true }));
  test("sin costo cargado: no se inventa", () => expect(margenDeOferta(900_000, null)).toEqual({ margenPct: null, pierde: false }));
});

describe("armarOfertas", () => {
  const v = (lote: number, producto: number, dias: number, quedan = 1000): FilaVencimiento => ({ lote_id: lote, producto_id: producto, nombre: "x", tipo_venta: "peso", quedan, vence_el: `2026-10-${10 + dias}`, dias_restantes: dias });
  const productos = [{ id: 1, nombre: "Jamón", tipoVenta: "peso" as const, precio: 2_000_000 }, { id: 2, nombre: "Queso", tipoVenta: "peso" as const, precio: 1_500_000 }];

  test("toma el lote que vence primero de cada producto y calcula el descuento", () => {
    const r = armarOfertas([v(1, 1, 10), v(2, 1, 2, 500), v(3, 2, 5)], productos, new Map([[1, 1_200_000]]));
    expect(r.map((f) => [f.nombre, f.diasRestantes, f.sugerido, f.quedan])).toEqual([["Jamón", 2, 30, 500], ["Queso", 5, 20, 1000]]);
    expect(r[0].costo).toBe(1_200_000);
    expect(r[1].costo).toBeNull();
  });
  test("lo ya vencido va primero y sin oferta (se retira)", () => {
    const r = armarOfertas([v(1, 2, 3), v(2, 1, -2)], productos, new Map());
    expect(r[0]).toMatchObject({ nombre: "Jamón", sugerido: null });
  });
  test("ignora lotes de productos que ya no están activos", () => expect(armarOfertas([v(1, 99, 2)], productos, new Map())).toEqual([]));
});

describe("precioAnteriorDeOferta", () => {
  const ahora = new Date("2026-10-09T12:00:00Z").getTime();
  test("baja reciente → devuelve el precio de antes", () => expect(precioAnteriorDeOferta([{ precio: 1_580_000, desde: "2026-10-08T12:00:00Z" }, { precio: 1_980_000, desde: "2026-09-01T00:00:00Z" }], ahora)).toBe(1_980_000));
  test("suba (inflación) → no es una oferta", () => expect(precioAnteriorDeOferta([{ precio: 2_000_000, desde: "2026-10-08T12:00:00Z" }, { precio: 1_900_000, desde: "2026-09-01T00:00:00Z" }], ahora)).toBeNull());
  test("baja vieja (más de 21 días) → ya no se ofrece volver", () => expect(precioAnteriorDeOferta([{ precio: 1_500_000, desde: "2026-09-01T00:00:00Z" }, { precio: 1_900_000, desde: "2026-08-01T00:00:00Z" }], ahora)).toBeNull());
  test("sin historial suficiente", () => {
    expect(precioAnteriorDeOferta([], ahora)).toBeNull();
    expect(precioAnteriorDeOferta([{ precio: 1, desde: "2026-10-08T00:00:00Z" }], ahora)).toBeNull();
  });
});

describe("textoCartel", () => {
  test("peso", () => {
    const t = textoCartel({ nombre: "Jamón cocido", tipoVenta: "peso", precioAnterior: 1_980_000, precioOferta: 1_580_000, descuento: 20, quedan: 3200 });
    expect(t).toBe("OFERTA: Jamón cocido\n$ 15.800,00 el kilo (antes $ 19.800,00, 20% menos)\nHasta agotar stock: quedan 3,2 kg.");
  });
  test("unidad y sin espacios raros", () => {
    const t = textoCartel({ nombre: "Prepizza", tipoVenta: "unidad", precioAnterior: 260_000, precioOferta: 190_000, descuento: 30, quedan: 3 });
    expect(t).toContain("cada una");
    expect(/[  ]/.test(t)).toBe(false);
  });
});
