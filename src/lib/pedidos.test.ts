import { describe, expect, it, test } from "vitest";
import { cantidadATextoEditable, cantidadSugerida, costoDelPedido, textoPedido } from "@/lib/pedidos";
import { cantidadConCeroABase } from "@/lib/stock";

describe("cantidadSugerida", () => {
  test("por ritmo: 30 kg vendidos en 30 días = 1 kg/día → una semana = 7 kg; hay 2 kg → pedir 5 kg", () => {
    expect(cantidadSugerida({ stock: 2000, minimo: 0, vendido: 30_000, tipoVenta: "peso" })).toEqual({ cantidad: 5000, motivo: "ritmo", porDia: 1000 });
  });
  test("por mínimo cuando no hay ventas: el doble del mínimo", () => {
    expect(cantidadSugerida({ stock: 0, minimo: 3000, vendido: 0, tipoVenta: "peso" })).toEqual({ cantidad: 6000, motivo: "minimo", porDia: null });
  });
  test("gana el que pide más", () => {
    expect(cantidadSugerida({ stock: 0, minimo: 1000, vendido: 30_000, tipoVenta: "peso" })).toMatchObject({ cantidad: 7000, motivo: "ritmo" });
    expect(cantidadSugerida({ stock: 0, minimo: 10_000, vendido: 3000, tipoVenta: "peso" })).toMatchObject({ cantidad: 20_000, motivo: "minimo" });
  });
  test("el stock negativo cuenta como cero (no se pide de más)", () => {
    expect(cantidadSugerida({ stock: -450, minimo: 3000, vendido: 0, tipoVenta: "peso" }).cantidad).toBe(6000);
  });
  test("si ya alcanza, no pide nada", () => expect(cantidadSugerida({ stock: 9000, minimo: 3000, vendido: 0, tipoVenta: "peso" }).cantidad).toBe(0));
  test("sin ritmo ni mínimo: NO inventa una cantidad", () => expect(cantidadSugerida({ stock: 0, minimo: 0, vendido: 0, tipoVenta: "unidad" })).toEqual({ cantidad: 0, motivo: "sin_datos", porDia: null }));
  test("el kilo se pide de a 500 g (redondea hacia arriba)", () => {
    expect(cantidadSugerida({ stock: 0, minimo: 0, vendido: 3100, tipoVenta: "peso" }).cantidad).toBe(1000); // 3100/30*7 = 723 g → 1 kg
    expect(cantidadSugerida({ stock: 0, minimo: 1200, vendido: 0, tipoVenta: "peso" }).cantidad).toBe(2500); // 2400 → 2,5 kg
  });
  test("por unidad: enteros, hacia arriba", () => {
    expect(cantidadSugerida({ stock: 3, minimo: 0, vendido: 20, tipoVenta: "unidad" })).toMatchObject({ cantidad: 2, motivo: "ritmo" }); // 20/30*7=4,67→5, faltan 2
    expect(cantidadSugerida({ stock: 0, minimo: 6, vendido: 0, tipoVenta: "unidad" }).cantidad).toBe(12);
  });
  test("tope de seguridad (un cero de más no pide una locura)", () => {
    expect(cantidadSugerida({ stock: 0, minimo: 5_000_000, vendido: 0, tipoVenta: "peso" }).cantidad).toBe(1_000_000);
    expect(cantidadSugerida({ stock: 0, minimo: 9_000_000, vendido: 0, tipoVenta: "unidad" }).cantidad).toBe(100_000);
  });
});

describe("costoDelPedido", () => {
  test("peso: gramos × costo por kilo", () => expect(costoDelPedido(5000, 1_350_000, "peso")).toBe(6_750_000));
  test("unidad", () => expect(costoDelPedido(12, 270_000, "unidad")).toBe(3_240_000));
  test("sin costo o sin cantidad → null", () => {
    expect(costoDelPedido(5000, null, "peso")).toBeNull();
    expect(costoDelPedido(0, 1000, "peso")).toBeNull();
  });
});

describe("textoPedido", () => {
  test("con proveedor y líneas (las de cantidad cero se omiten)", () => {
    const t = textoPedido("Frigorífico Del Sur", [
      { nombre: "Jamón cocido", tipoVenta: "peso", cantidad: 5000 },
      { nombre: "Mortadela", tipoVenta: "peso", cantidad: 0 },
      { nombre: "Papas fritas", tipoVenta: "unidad", cantidad: 12 },
    ]);
    expect(t).toBe("Hola Frigorífico Del Sur! Quisiera hacer el siguiente pedido:\n\n- Jamón cocido: 5 kg\n- Papas fritas: 12 u.\n\nGracias. El Arte del Buen Comer");
  });
  test("sin proveedor", () => expect(textoPedido(null, [{ nombre: "X", tipoVenta: "unidad", cantidad: 1 }]).startsWith("Hola! Quisiera")).toBe(true));
});

describe("cantidadATextoEditable", () => {
  it.each([[1500, "1,5"], [500, "0,5"], [2000, "2"], [250, "0,25"], [1005, "1,005"], [0, "0"]])("%i g → %s", (g, t) => {
    expect(cantidadATextoEditable(g, "peso")).toBe(t);
  });
  it("unidades sin decimales", () => expect(cantidadATextoEditable(12, "unidad")).toBe("12"));
  it("ida y vuelta con cantidadConCeroABase", () => {
    for (const g of [0, 250, 500, 1005, 1500, 99_000]) expect(cantidadConCeroABase(cantidadATextoEditable(g, "peso"), "peso")).toBe(g);
  });
});
