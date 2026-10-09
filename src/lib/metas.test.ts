import { describe, expect, test } from "vitest";
import {
  diaDelMes,
  diasDelMes,
  primerDiaDelMes,
  proyectarMes,
  puntoDeEquilibrio,
  validarMonto,
  validarNombre,
  validarTelefono,
} from "@/lib/metas";

describe("fechas del mes", () => {
  test.each([["2026-10-09", 31], ["2026-02-10", 28], ["2024-02-10", 29], ["2026-04-30", 30], ["2100-02-01", 28], ["2000-02-01", 29]])(
    "%s → %i días",
    (f, n) => expect(diasDelMes(f)).toBe(n),
  );
  test("primerDiaDelMes y diaDelMes", () => {
    expect(primerDiaDelMes("2026-10-09")).toBe("2026-10-01");
    expect(primerDiaDelMes("2026-02-28")).toBe("2026-02-01");
    expect(diaDelMes("2026-10-09")).toBe(9);
    expect(diaDelMes("2026-10-31")).toBe(31);
  });
  test.each(["hola", "2026-13-01", "2026-02-30", "2026-10-9", ""])("fecha inválida «%s»", (f) => {
    expect(() => diasDelMes(f)).toThrow();
    expect(() => primerDiaDelMes(f)).toThrow();
    expect(() => diaDelMes(f)).toThrow();
  });
});

describe("proyectarMes", () => {
  // Octubre: 31 días. Hoy es el 10: 9 días completos de $100 y hoy $30 en curso.
  const nueve100 = Array(9).fill(10_000);
  const dias = [...nueve100, 3_000];

  test("ritmo y proyección salen de los días COMPLETOS (hoy todavía no terminó)", () => {
    const p = proyectarMes("2026-10-10", dias, 400_000);
    expect(p.ritmoDiario).toBe(10_000);
    expect(p.proyeccion).toBe(310_000);
    expect(p.vendido).toBe(93_000);
    expect(p.confiable).toBe(true); // 9 días completos
  });

  test("va bien si el ritmo alcanza", () => {
    expect(proyectarMes("2026-10-10", dias, 300_000).estado).toBe("va_bien");
    expect(proyectarMes("2026-10-10", dias, 310_000).estado).toBe("va_bien"); // justo
    expect(proyectarMes("2026-10-10", dias, 310_001).estado).toBe("atrasado");
  });

  test("faltante, días restantes y cuánto hay que vender por día", () => {
    const p = proyectarMes("2026-10-10", dias, 400_000);
    expect(p.faltante).toBe(307_000);
    expect(p.diasRestantes).toBe(22); // del 10 al 31, hoy incluido
    expect(p.necesarioPorDia).toBe(Math.ceil(307_000 / 22));
    expect(p.porcentajeAvance).toBe(23); // 93.000 / 400.000 = 23,25 %
  });

  test("meta cumplida: no queda faltante ni exigencia diaria", () => {
    const p = proyectarMes("2026-10-10", dias, 90_000);
    expect(p.estado).toBe("cumplida");
    expect(p.faltante).toBe(0);
    expect(p.necesarioPorDia).toBeNull();
    expect(p.porcentajeAvance).toBe(100);
  });

  test("sin meta: igual informa el ritmo, pero no inventa faltantes", () => {
    const p = proyectarMes("2026-10-10", dias, null);
    expect(p.estado).toBe("sin_meta");
    expect(p.faltante).toBeNull();
    expect(p.necesarioPorDia).toBeNull();
    expect(p.porcentajeAvance).toBeNull();
    expect(p.proyeccion).toBe(310_000);
  });

  test("el día 1 no hay ningún día completo: no se proyecta", () => {
    const p = proyectarMes("2026-10-01", [5_000], 400_000);
    expect(p.estado).toBe("sin_datos");
    expect(p.ritmoDiario).toBeNull();
    expect(p.proyeccion).toBeNull();
    expect(p.confiable).toBe(false);
    expect(p.diasRestantes).toBe(31);
  });

  test("con menos de 7 días completos la proyección existe pero NO es confiable", () => {
    const p = proyectarMes("2026-10-07", [1, 1, 1, 1, 1, 1, 1], 100);
    expect(p.confiable).toBe(false); // 6 completos
    expect(proyectarMes("2026-10-08", [1, 1, 1, 1, 1, 1, 1, 1], 100).confiable).toBe(true); // 7 completos
  });

  test("último día del mes: queda 1 día (hoy)", () => {
    const todo = Array(31).fill(1_000);
    const p = proyectarMes("2026-10-31", todo, 100_000);
    expect(p.diasRestantes).toBe(1);
    expect(p.necesarioPorDia).toBe(69_000);
  });

  test("hoy sin ventas todavía no arruina el ritmo", () => {
    const p = proyectarMes("2026-10-10", [...nueve100, 0], 400_000);
    expect(p.ritmoDiario).toBe(10_000);
  });

  test("la cantidad de días tiene que coincidir con la fecha", () => {
    expect(() => proyectarMes("2026-10-10", [1, 2, 3], 100)).toThrow();
  });

  test("el avance nunca pasa de 100 %", () => {
    expect(proyectarMes("2026-10-10", dias, 1_000).porcentajeAvance).toBe(100);
  });
});

describe("puntoDeEquilibrio", () => {
  test("gastos / margen", () => {
    // gastos $500.000 (50.000.000 centavos), margen 40 % → hay que vender $1.250.000 al mes
    expect(puntoDeEquilibrio(50_000_000, 40, 31)).toEqual({ ventasMensuales: 125_000_000, ventasPorDia: Math.ceil(125_000_000 / 31) });
  });
  test("redondea hacia arriba (nunca promete de menos)", () => {
    expect(puntoDeEquilibrio(1000, 30, 30)?.ventasMensuales).toBe(3334);
  });
  test("sin gastos el punto de equilibrio es cero", () => {
    expect(puntoDeEquilibrio(0, 40, 30)).toEqual({ ventasMensuales: 0, ventasPorDia: 0 });
  });
  test.each([[null], [0], [-5]])("margen %s → no existe", (m) => expect(puntoDeEquilibrio(1000, m, 30)).toBeNull());
  test("entradas absurdas → null", () => {
    expect(puntoDeEquilibrio(-1, 40, 30)).toBeNull();
    expect(puntoDeEquilibrio(1000, 40, 0)).toBeNull();
  });
});

describe("validarMonto", () => {
  test.each([["1200000", 120_000_000], ["1.200.000", 120_000_000], ["1.200.000,50", 120_000_050], ["$ 500", 50_000]])(
    "«%s» → %i centavos",
    (t, c) => expect(validarMonto(t)).toEqual({ ok: true, centavos: c }),
  );
  test.each([[""], ["   "], ["abc"], ["-5"], ["1,5,5"], ["99999999999"]])("«%s» se rechaza", (t) => {
    expect(validarMonto(t).ok).toBe(false);
  });
  test("cero: rechazado salvo que se permita", () => {
    expect(validarMonto("0").ok).toBe(false);
    expect(validarMonto("0", { permitirCero: true })).toEqual({ ok: true, centavos: 0 });
  });
});

describe("validarNombre y validarTelefono", () => {
  test("nombre: recorta y junta espacios", () => {
    expect(validarNombre("  Frigorífico   Sur ", "el nombre")).toEqual({ ok: true, nombre: "Frigorífico Sur" });
  });
  test("nombre vacío o largo", () => {
    expect(validarNombre("   ", "el nombre").ok).toBe(false);
    expect(validarNombre("x".repeat(61), "el nombre").ok).toBe(false);
    expect(validarNombre("x".repeat(60), "el nombre").ok).toBe(true);
  });
  test.each([["", null], ["  ", null], ["11 5555-1234", "11 5555-1234"], ["+54 (11) 5555 1234", "+54 (11) 5555 1234"]])(
    "teléfono «%s»",
    (t, esperado) => expect(validarTelefono(t)).toEqual({ ok: true, telefono: esperado }),
  );
  test.each([["abc"], ["12"], ["<script>"], ["1".repeat(26)]])("teléfono inválido «%s»", (t) => {
    expect(validarTelefono(t).ok).toBe(false);
  });
});
