import { describe, expect, test } from "vitest";
import { diaArgentina, formatearFechaHora, formatearHora } from "@/lib/fechas";

describe("fechas en hora de Argentina (UTC-3), sin importar la zona del servidor", () => {
  test("formatearFechaHora", () => {
    expect(formatearFechaHora("2026-10-09T19:47:29Z")).toBe("09/10/2026 16:47");
  });

  test("formatearHora", () => expect(formatearHora("2026-10-09T19:47:29Z")).toBe("16:47"));

  test("acepta un Date además de un texto", () => {
    expect(formatearHora(new Date("2026-10-09T19:47:29Z"))).toBe("16:47");
  });

  test("medianoche: 23:59 en Argentina sigue siendo el MISMO día (aunque en UTC ya sea el siguiente)", () => {
    expect(formatearFechaHora("2026-10-10T02:59:00Z")).toBe("09/10/2026 23:59");
    expect(diaArgentina("2026-10-10T02:59:00Z")).toBe("2026-10-09");
  });

  test("el día cambia exactamente a las 00:00 de Argentina (03:00 UTC)", () => {
    expect(diaArgentina("2026-10-10T02:59:59Z")).toBe("2026-10-09");
    expect(diaArgentina("2026-10-10T03:00:00Z")).toBe("2026-10-10");
  });

  test("diaArgentina tiene formato AAAA-MM-DD ordenable", () => {
    expect(diaArgentina("2026-01-05T15:00:00Z")).toBe("2026-01-05");
  });

  test.each([["texto basura", "no es una fecha"], ["vacío", ""]])("fecha inválida: %s", (_n, v) => {
    expect(() => formatearFechaHora(v)).toThrow();
    expect(() => diaArgentina(v)).toThrow();
  });
});
