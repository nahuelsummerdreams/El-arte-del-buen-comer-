import { describe, expect, test } from "vitest";
import {
  agregarAlCarrito,
  armarVenta,
  calcularVuelto,
  cambiarCantidad,
  mensajeDeErrorDeVenta,
  quitarDelCarrito,
  subtotalCarrito,
  totalConDescuento,
  validarDescuento,
  type ProductoVendible,
} from "@/lib/venta";

const jamon: ProductoVendible = { id: 1, nombre: "Jamón cocido", tipoVenta: "peso", precioCentavos: 2_000_000 };
const gaseosa: ProductoVendible = { id: 2, nombre: "Gaseosa", tipoVenta: "unidad", precioCentavos: 350_000 };
const queso: ProductoVendible = { id: 3, nombre: "Queso", tipoVenta: "peso", precioCentavos: 1_999_999 };

describe("carrito · agregar", () => {
  test("agrega un producto nuevo", () => {
    expect(agregarAlCarrito([], jamon, 250)).toEqual([{ producto: jamon, cantidad: 250 }]);
  });

  test("si el producto ya está, SUMA la cantidad (no duplica la línea)", () => {
    const c = agregarAlCarrito(agregarAlCarrito([], jamon, 250), jamon, 100);
    expect(c).toEqual([{ producto: jamon, cantidad: 350 }]);
  });

  test("no modifica el carrito original (inmutable)", () => {
    const original = agregarAlCarrito([], gaseosa, 1);
    agregarAlCarrito(original, gaseosa, 5);
    expect(original).toEqual([{ producto: gaseosa, cantidad: 1 }]);
  });

  test("mantiene el orden en que se fueron agregando", () => {
    const c = agregarAlCarrito(agregarAlCarrito(agregarAlCarrito([], jamon, 100), gaseosa, 2), queso, 50);
    expect(c.map((l) => l.producto.id)).toEqual([1, 2, 3]);
  });

  test.each([["cero", 0], ["negativa", -1], ["decimal", 1.5], ["NaN", Number.NaN]])("rechaza cantidad %s", (_n, q) => {
    expect(() => agregarAlCarrito([], gaseosa, q)).toThrow();
  });

  test("tope por línea: 1.000 kg por peso", () => {
    expect(() => agregarAlCarrito([], jamon, 1_000_001)).toThrow();
    expect(agregarAlCarrito([], jamon, 1_000_000)[0].cantidad).toBe(1_000_000);
  });

  test("tope por línea: 100.000 unidades (también al SUMAR)", () => {
    expect(() => agregarAlCarrito([], gaseosa, 100_001)).toThrow();
    const c = agregarAlCarrito([], gaseosa, 99_999);
    expect(() => agregarAlCarrito(c, gaseosa, 2)).toThrow();
  });

  test("tope de 100 líneas distintas", () => {
    let c = [] as ReturnType<typeof agregarAlCarrito>;
    for (let i = 1; i <= 100; i++) c = agregarAlCarrito(c, { ...gaseosa, id: i }, 1);
    expect(c).toHaveLength(100);
    expect(() => agregarAlCarrito(c, { ...gaseosa, id: 101 }, 1)).toThrow();
    expect(agregarAlCarrito(c, { ...gaseosa, id: 100 }, 1)[99].cantidad).toBe(2); // sumar a una existente sí
  });
});

describe("carrito · cambiar y quitar", () => {
  const base = agregarAlCarrito(agregarAlCarrito([], jamon, 250), gaseosa, 3);

  test("cambiarCantidad reemplaza (no suma)", () => {
    expect(cambiarCantidad(base, 1, 500).find((l) => l.producto.id === 1)?.cantidad).toBe(500);
  });

  test("cambiarCantidad a 0 quita la línea", () => {
    expect(cambiarCantidad(base, 2, 0).map((l) => l.producto.id)).toEqual([1]);
  });

  test("cambiarCantidad de un producto que no está no cambia nada", () => {
    expect(cambiarCantidad(base, 999, 5)).toEqual(base);
  });

  test("cambiarCantidad rechaza valores inválidos", () => {
    expect(() => cambiarCantidad(base, 1, -3)).toThrow();
    expect(() => cambiarCantidad(base, 1, 2.5)).toThrow();
  });

  test("quitarDelCarrito", () => {
    expect(quitarDelCarrito(base, 1).map((l) => l.producto.id)).toEqual([2]);
    expect(quitarDelCarrito(base, 999)).toEqual(base);
  });
});

describe("carrito · importes", () => {
  test("subtotal: 250 g de jamón a $20.000/kg + 3 gaseosas a $3.500 = $15.500", () => {
    const c = agregarAlCarrito(agregarAlCarrito([], jamon, 250), gaseosa, 3);
    expect(subtotalCarrito(c)).toBe(500_000 + 1_050_000);
  });

  test("subtotal de un carrito vacío es 0", () => expect(subtotalCarrito([])).toBe(0));

  test("redondea cada línea por separado (igual que la base)", () => {
    expect(subtotalCarrito(agregarAlCarrito([], queso, 333))).toBe(666_000);
  });

  test("totalConDescuento", () => {
    expect(totalConDescuento(1_550_000, 50_000)).toBe(1_500_000);
    expect(totalConDescuento(1_550_000, 0)).toBe(1_550_000);
  });

  test("el descuento no puede superar el subtotal ni ser negativo", () => {
    expect(() => totalConDescuento(1000, 1001)).toThrow();
    expect(() => totalConDescuento(1000, -1)).toThrow();
  });
});

describe("validarDescuento", () => {
  test.each([
    ["500", 50_000],
    ["1.000,50", 100_050],
    ["0", 0],
    ["", 0], // vacío = sin descuento
    ["   ", 0],
  ])("«%s» → %i centavos", (texto, centavos) => {
    expect(validarDescuento(texto, 1_550_000)).toEqual({ ok: true, centavos });
  });

  test("no puede superar el subtotal", () => {
    const r = validarDescuento("20.000", 1_550_000);
    expect(!r.ok && r.error).toMatch(/subtotal/i);
  });

  test("tampoco puede IGUALAR al subtotal: el total tiene que quedar mayor a cero", () => {
    expect(validarDescuento("15.500", 1_550_000).ok).toBe(false);
  });

  test.each([["letras", "abc"], ["negativo", "-5"], ["ambiguo", "1,000.50"]])("rechaza %s", (_n, t) => {
    expect(validarDescuento(t, 1_550_000).ok).toBe(false);
  });
});

describe("armarVenta · lo que se manda al servidor", () => {
  const c = agregarAlCarrito(agregarAlCarrito([], jamon, 250), gaseosa, 3);

  test("manda SOLO producto y cantidad: NUNCA precios", () => {
    const v = armarVenta(c, "efectivo", 0);
    expect(v.items).toEqual([
      { producto_id: 1, cantidad: 250 },
      { producto_id: 2, cantidad: 3 },
    ]);
    expect(JSON.stringify(v.items)).not.toMatch(/precio|subtotal/i);
  });

  test("el pago cubre exactamente el total", () => {
    expect(armarVenta(c, "tarjeta", 0).pagos).toEqual([{ medio: "tarjeta", monto: 1_550_000 }]);
  });

  test("con descuento, el pago es el total ya descontado", () => {
    const v = armarVenta(c, "efectivo", 50_000);
    expect(v.pagos).toEqual([{ medio: "efectivo", monto: 1_500_000 }]);
    expect(v.descuentoCentavos).toBe(50_000);
  });

  test("carrito vacío se rechaza", () => expect(() => armarVenta([], "efectivo", 0)).toThrow());
  test("descuento igual al subtotal se rechaza (total cero)", () =>
    expect(() => armarVenta(c, "efectivo", 1_550_000)).toThrow());
});

describe("calcularVuelto", () => {
  test("recibido mayor al total", () => expect(calcularVuelto(1_550_000, 2_000_000)).toEqual({ ok: true, vuelto: 450_000 }));
  test("recibido justo", () => expect(calcularVuelto(1_550_000, 1_550_000)).toEqual({ ok: true, vuelto: 0 }));
  test("recibido insuficiente: informa cuánto falta", () =>
    expect(calcularVuelto(1_550_000, 1_000_000)).toEqual({ ok: false, falta: 550_000 }));
});

describe("mensajeDeErrorDeVenta", () => {
  const msg = (m: string, code?: string) => mensajeDeErrorDeVenta({ message: m, code });

  test("caja cerrada", () => expect(msg("caja_cerrada")).toMatch(/abrí la caja/i));
  test("los precios cambiaron (pagos no coinciden)", () => {
    expect(msg("pagos_no_coinciden")).toMatch(/precios cambiaron/i);
  });
  test("producto ya no disponible", () => expect(msg("producto_invalido")).toMatch(/ya no está disponible/i));
  test("producto sin precio", () => expect(msg("producto_sin_precio")).toMatch(/sin precio/i));
  test("descuento no autorizado", () => expect(msg("descuento_no_autorizado", "42501")).toMatch(/dueño/i));
  test("descuento inválido", () => expect(msg("descuento_invalido")).toMatch(/descuento/i));
  test("carrito vacío", () => expect(msg("carrito_vacio")).toMatch(/vacío/i));
  test("red", () => expect(msg("TypeError: fetch failed")).toMatch(/conectar/i));
  test("importe enorme", () => expect(msg("importe_demasiado_grande")).toMatch(/demasiado grande/i));
  test("genérico sin detalles internos", () => {
    const m = msg('relation "secreta" no existe', "XX000");
    expect(m).not.toContain("secreta");
    expect(m).toMatch(/no se pudo registrar la venta/i);
  });
});

import { validarEnvioVenta } from "@/lib/venta";

describe("validarEnvioVenta · lo que llega del navegador al cobrar", () => {
  const CLAVE = "3f2b8c1e-5a7d-4e90-9c1b-0a1b2c3d4e5f";
  const bueno = {
    items: JSON.stringify([{ producto_id: 1, cantidad: 250 }, { producto_id: 2, cantidad: 3 }]),
    medio: "efectivo",
    total: "1550000",
    descuento: "0",
    clave: CLAVE,
  };

  test("arma los items, el pago por el total y el descuento", () => {
    expect(validarEnvioVenta(bueno)).toEqual({
      ok: true,
      valores: {
        items: [{ producto_id: 1, cantidad: 250 }, { producto_id: 2, cantidad: 3 }],
        pagos: [{ medio: "efectivo", monto: 1_550_000 }],
        descuento: 0,
        clave: CLAVE,
      },
    });
  });

  test("ignora campos de más en los items (por ejemplo, un precio inventado)", () => {
    const r = validarEnvioVenta({ ...bueno, items: JSON.stringify([{ producto_id: 1, cantidad: 5, precio: 1, subtotal: 1 }]) });
    expect(r.ok && r.valores.items).toEqual([{ producto_id: 1, cantidad: 5 }]);
    expect(JSON.stringify(r)).not.toMatch(/precio|subtotal/);
  });

  test("descuento y clave en mayúsculas se normalizan", () => {
    const r = validarEnvioVenta({ ...bueno, descuento: "50000", clave: CLAVE.toUpperCase() });
    expect(r.ok && r.valores.descuento).toBe(50_000);
    expect(r.ok && r.valores.clave).toBe(CLAVE);
  });

  test.each([
    ["items no es JSON", { items: "{{{" }],
    ["items no es una lista", { items: '{"a":1}' }],
    ["items vacío", { items: "[]" }],
    ["más de 100 líneas", { items: JSON.stringify(Array.from({ length: 101 }, (_, i) => ({ producto_id: i + 1, cantidad: 1 }))) }],
    ["producto_id decimal", { items: JSON.stringify([{ producto_id: 1.5, cantidad: 1 }]) }],
    ["producto_id texto", { items: JSON.stringify([{ producto_id: "1", cantidad: 1 }]) }],
    ["cantidad cero", { items: JSON.stringify([{ producto_id: 1, cantidad: 0 }]) }],
    ["cantidad negativa", { items: JSON.stringify([{ producto_id: 1, cantidad: -2 }]) }],
    ["cantidad decimal", { items: JSON.stringify([{ producto_id: 1, cantidad: 2.5 }]) }],
    ["cantidad enorme", { items: JSON.stringify([{ producto_id: 1, cantidad: 1_000_001 }]) }],
    ["un item nulo", { items: "[null]" }],
    ["medio inventado", { medio: "cheque" }],
    ["medio vacío", { medio: "" }],
    ["total vacío", { total: "" }],
    ["total cero", { total: "0" }],
    ["total negativo", { total: "-5" }],
    ["total decimal", { total: "10.5" }],
    ["total más grande que un integer de la base", { total: "2147483648" }],
    ["descuento negativo", { descuento: "-1" }],
    ["descuento decimal", { descuento: "1.5" }],
    ["clave inválida", { clave: "12345" }],
    ["clave vacía", { clave: "" }],
  ])("rechaza: %s", (_n, cambio) => {
    expect(validarEnvioVenta({ ...bueno, ...cambio }).ok).toBe(false);
  });

  test("el descuento vacío cuenta como 0", () => {
    const r = validarEnvioVenta({ ...bueno, descuento: "" });
    expect(r.ok && r.valores.descuento).toBe(0);
  });

  test("no es texto → se rechaza", () => {
    expect(validarEnvioVenta({ ...bueno, items: null }).ok).toBe(false);
  });
});

import { leerKilos } from "@/lib/venta";

describe("leerKilos · kilos escritos en el mostrador → gramos", () => {
  test.each([["0,35", 350], ["0,350", 350], ["1", 1000], ["2,5", 2500], ["  0,1  ", 100], ["1000", 1_000_000]])(
    "«%s» kg → %i g",
    (texto, gramos) => expect(leerKilos(texto)).toEqual({ ok: true, gramos }),
  );

  test("vacío pide escribir la cantidad", () => {
    const r = leerKilos("  ");
    expect(!r.ok && r.error).toMatch(/escribí/i);
  });

  test("el punto se rechaza diciendo que use coma", () => {
    const r = leerKilos("0.35");
    expect(!r.ok && r.error).toMatch(/coma/i);
  });

  test.each([["cero", "0"], ["letras", "abc"], ["más de 1.000 kg", "1000,001"], ["negativo", "-1"]])("rechaza %s", (_n, t) => {
    expect(leerKilos(t).ok).toBe(false);
  });

  test("el mensaje de cantidad cero es claro", () => {
    const r = leerKilos("0");
    expect(!r.ok && r.error).toMatch(/mayor a cero/i);
  });
});
