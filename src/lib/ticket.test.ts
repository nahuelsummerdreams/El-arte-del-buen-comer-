import { describe, expect, test } from "vitest";
import { enlaceWhatsApp, textoComprobante, type DatosComprobante } from "@/lib/ticket";

const base: DatosComprobante = {
  numero: 12,
  fechaTexto: "09/10/2026 20:47",
  lineas: [
    { nombre: "Jamón cocido", tipoVenta: "peso", cantidad: 250, precioUnitarioCentavos: 1_980_000, subtotalCentavos: 495_000 },
    { nombre: "Gaseosa 1,5 L", tipoVenta: "unidad", cantidad: 2, precioUnitarioCentavos: 360_000, subtotalCentavos: 720_000 },
  ],
  subtotalCentavos: 1_215_000,
  descuentoCentavos: 0,
  totalCentavos: 1_215_000,
  pagos: [{ medio: "efectivo", montoCentavos: 1_215_000 }],
};

describe("textoComprobante", () => {
  const t = textoComprobante(base);
  test("encabezado, líneas, total y medio de pago", () => {
    expect(t).toContain("El Arte del Buen Comer");
    expect(t).toContain("Comprobante N.º 12");
    expect(t).toContain("Jamón cocido\n  250 g x $ 19.800,00/kg = $ 4.950,00");
    expect(t).toContain("Gaseosa 1,5 L\n  2 u. x $ 3.600,00 = $ 7.200,00");
    expect(t).toContain("TOTAL: $ 12.150,00");
    expect(t).toContain("Efectivo: $ 12.150,00");
  });
  test("aclara que no es factura", () => expect(t).toContain("Comprobante no válido como factura."));
  test("sin descuento no aparecen subtotal ni descuento", () => {
    expect(t).not.toContain("Subtotal");
    expect(t).not.toContain("Descuento");
  });
  test("con descuento sí, y el total ya viene descontado", () => {
    const c = textoComprobante({ ...base, descuentoCentavos: 15_000, totalCentavos: 1_200_000 });
    expect(c).toContain("Subtotal: $ 12.150,00");
    expect(c).toContain("Descuento: -$ 150,00");
    expect(c).toContain("TOTAL: $ 12.000,00");
  });
  test("pagos divididos: una línea por medio", () => {
    const c = textoComprobante({ ...base, pagos: [{ medio: "efectivo", montoCentavos: 1_000_000 }, { medio: "tarjeta", montoCentavos: 215_000 }] });
    expect(c).toContain("Efectivo: $ 10.000,00");
    expect(c).toContain("Tarjeta: $ 2.150,00");
  });
  test("no deja espacios «no separables» (WhatsApp los muestra raros)", () => expect(/[  ]/.test(t)).toBe(false));
});

describe("enlaceWhatsApp", () => {
  test("sin teléfono: abre WhatsApp para elegir contacto, con el texto codificado", () => {
    const e = enlaceWhatsApp("Hola & chau\n2 x 3");
    expect(e).toBe("https://wa.me/?text=Hola%20%26%20chau%0A2%20x%203");
  });
  test("con teléfono internacional (+54…): lo usa solo con dígitos", () => expect(enlaceWhatsApp("hola", "+54 9 11 5555-1234")).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=hola$/));
  test("teléfono sin código de país: NO se adivina (el prefijo dependería del número)", () => expect(enlaceWhatsApp("hola", "11 5555-1234")).toBe("https://wa.me/?text=hola"));
  test("teléfono absurdo → sin número", () => {
    expect(enlaceWhatsApp("hola", "+1")).toBe("https://wa.me/?text=hola");
    expect(enlaceWhatsApp("hola", "+" + "1".repeat(20))).toBe("https://wa.me/?text=hola");
    expect(enlaceWhatsApp("hola", null)).toBe("https://wa.me/?text=hola");
  });
  test("un texto larguísimo se corta (los enlaces tienen tope)", () => {
    const e = enlaceWhatsApp("a".repeat(10_000));
    expect(decodeURIComponent(e.split("text=")[1]).length).toBe(3500);
  });
});
