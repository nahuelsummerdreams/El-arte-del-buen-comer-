import { describe, expect, test } from "vitest";
import {
  leerResumenTurno,
  mensajeDeErrorDeCaja,
  MEDIOS_DE_PAGO,
  validarApertura,
  validarCierre,
  validarMovimientoCaja,
} from "@/lib/caja";

describe("validarApertura", () => {
  test.each([
    ["5.000", 500_000],
    ["5.000,50", 500_050],
    ["0", 0],
    ["  12000  ", 1_200_000],
  ])("«%s» → %i centavos", (texto, centavos) => {
    expect(validarApertura({ efectivoInicial: texto })).toEqual({ ok: true, valores: { efectivoInicial: centavos } });
  });

  test("vacío se rechaza: hay que escribir 0 a propósito", () => {
    const r = validarApertura({ efectivoInicial: "" });
    expect(!r.ok && r.errores.efectivoInicial).toMatch(/escribí 0/i);
  });

  test.each([["negativo", "-5"], ["letras", "abc"], ["ambiguo", "1,000.50"], ["enorme", "99.999.999.999"]])("rechaza %s", (_n, t) => {
    expect(validarApertura({ efectivoInicial: t }).ok).toBe(false);
  });

  test("no es texto", () => expect(validarApertura({ efectivoInicial: null }).ok).toBe(false));
});

describe("validarCierre", () => {
  test("acepta el efectivo contado y una nota opcional", () => {
    expect(validarCierre({ efectivoContado: "19.500,50", nota: "  faltó un billete  " })).toEqual({
      ok: true,
      valores: { efectivoContado: 1_950_050, nota: "faltó un billete" },
    });
  });

  test("contado 0 es válido (caja vacía)", () => {
    const r = validarCierre({ efectivoContado: "0", nota: "" });
    expect(r.ok && r.valores).toEqual({ efectivoContado: 0, nota: null });
  });

  test("contado vacío se rechaza", () => {
    const r = validarCierre({ efectivoContado: "", nota: "" });
    expect(!r.ok && r.errores.efectivoContado).toBeDefined();
  });

  test("contado inválido", () => expect(validarCierre({ efectivoContado: "mucho", nota: "" }).ok).toBe(false));

  test("nota de más de 200 caracteres", () => {
    const r = validarCierre({ efectivoContado: "0", nota: "a".repeat(201) });
    expect(!r.ok && r.errores.nota).toBeDefined();
  });
});

describe("validarMovimientoCaja", () => {
  const ok = { tipo: "retiro", monto: "1.000", motivo: "Pago a proveedor" };

  test("acepta un retiro válido", () => {
    expect(validarMovimientoCaja(ok)).toEqual({
      ok: true,
      valores: { tipo: "retiro", montoCentavos: 100_000, motivo: "Pago a proveedor" },
    });
  });

  test.each(["retiro", "gasto", "ingreso"])("acepta el tipo %s", (tipo) => {
    expect(validarMovimientoCaja({ ...ok, tipo }).ok).toBe(true);
  });

  test("recorta el motivo y junta espacios", () => {
    const r = validarMovimientoCaja({ ...ok, motivo: "  Pago   a   proveedor  " });
    expect(r.ok && r.valores.motivo).toBe("Pago a proveedor");
  });

  test.each([["inventado", "robo"], ["vacío", ""], ["nulo", null]])("tipo %s", (_n, tipo) => {
    const r = validarMovimientoCaja({ ...ok, tipo });
    expect(!r.ok && r.errores.tipo).toBeDefined();
  });

  test.each([["cero", "0"], ["vacío", ""], ["negativo", "-1"], ["letras", "x"]])("monto %s", (_n, monto) => {
    const r = validarMovimientoCaja({ ...ok, monto });
    expect(!r.ok && r.errores.monto).toBeDefined();
  });

  test("monto cero dice que debe ser mayor a cero", () => {
    const r = validarMovimientoCaja({ ...ok, monto: "0" });
    expect(!r.ok && r.errores.monto).toMatch(/mayor a cero/i);
  });

  test.each([["vacío", ""], ["muy corto", "ab"], ["muy largo", "a".repeat(121)]])("motivo %s", (_n, motivo) => {
    const r = validarMovimientoCaja({ ...ok, motivo });
    expect(!r.ok && r.errores.motivo).toBeDefined();
  });

  test("informa todos los errores a la vez", () => {
    const r = validarMovimientoCaja({ tipo: "", monto: "", motivo: "" });
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["monto", "motivo", "tipo"]);
  });
});

describe("mensajeDeErrorDeCaja", () => {
  test("caja cerrada", () => expect(mensajeDeErrorDeCaja({ message: "caja_cerrada" })).toMatch(/abrila/i));
  test("caja ya cerrada", () => expect(mensajeDeErrorDeCaja({ message: "caja_ya_cerrada" })).toMatch(/ya fue cerrada/i));
  test("ya hay una caja abierta", () =>
    expect(
      mensajeDeErrorDeCaja({ code: "23505", message: 'duplicate key value violates unique constraint "un_solo_turno_abierto"' }),
    ).toMatch(/ya hay una caja abierta/i));
  test("sin permiso", () => expect(mensajeDeErrorDeCaja({ code: "42501", message: "rls" })).toMatch(/permiso/i));
  test("red", () => expect(mensajeDeErrorDeCaja({ message: "TypeError: fetch failed" })).toMatch(/conectar/i));
  test("genérico, sin detalles internos", () => {
    const m = mensajeDeErrorDeCaja({ code: "XX", message: 'relation "secreta" no existe' });
    expect(m).not.toContain("secreta");
    expect(m).toMatch(/intent/i);
  });
});

describe("leerResumenTurno", () => {
  const bueno = {
    turno_id: 3,
    efectivo_inicial: 500_000,
    ventas_cantidad: 6,
    ventas_total: 8_366_000,
    descuentos: 50_000,
    por_medio: { efectivo: 7_500_000, tarjeta: 866_000 },
    ingresos_caja: 0,
    retiros_caja: 100_000,
    gastos_caja: 0,
    efectivo_esperado: 7_900_000,
    efectivo_contado: 9_999_999,
    diferencia: 2_099_999,
  };

  test("convierte el JSON de la base a un objeto tipado", () => {
    expect(leerResumenTurno(bueno)).toEqual({
      turnoId: 3,
      efectivoInicial: 500_000,
      ventasCantidad: 6,
      ventasTotal: 8_366_000,
      descuentos: 50_000,
      porMedio: { efectivo: 7_500_000, tarjeta: 866_000 },
      ingresosCaja: 0,
      retirosCaja: 100_000,
      gastosCaja: 0,
      efectivoEsperado: 7_900_000,
      efectivoContado: 9_999_999,
      diferencia: 2_099_999,
    });
  });

  test("contado y diferencia pueden ser null (caja todavía abierta)", () => {
    const r = leerResumenTurno({ ...bueno, efectivo_contado: null, diferencia: null });
    expect(r?.efectivoContado).toBeNull();
    expect(r?.diferencia).toBeNull();
  });

  test("diferencia negativa (faltante) se conserva", () => {
    expect(leerResumenTurno({ ...bueno, diferencia: -1500 })?.diferencia).toBe(-1500);
  });

  test("ignora medios de pago desconocidos", () => {
    const r = leerResumenTurno({ ...bueno, por_medio: { efectivo: 1, cheque: 99 } });
    expect(r?.porMedio).toEqual({ efectivo: 1 });
  });

  test.each([["null", null], ["texto", "x"], ["lista", []], ["falta un campo", { ...bueno, ventas_total: undefined }], ["número como texto", { ...bueno, ventas_total: "5" }], ["decimal", { ...bueno, ventas_total: 1.5 }]])(
    "devuelve null si el dato es inválido: %s",
    (_n, valor) => expect(leerResumenTurno(valor)).toBeNull(),
  );
});

describe("MEDIOS_DE_PAGO", () => {
  test("están los cuatro medios, con etiqueta en español", () => {
    expect(MEDIOS_DE_PAGO.map((m) => m.valor)).toEqual(["efectivo", "tarjeta", "transferencia", "billetera"]);
    expect(MEDIOS_DE_PAGO.every((m) => m.etiqueta.length > 0)).toBe(true);
  });
});
