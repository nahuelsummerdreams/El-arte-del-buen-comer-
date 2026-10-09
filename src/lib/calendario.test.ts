import { describe, expect, test } from "vitest";
import {
  cuadriculaDelMes, diasDelMes, feriadoDe, indiceDeSemana, leerDia, leerMes, mesAnterior, mesDe, mesSiguiente, mesesEntre, nombreDeMes, rangoDelMes, saludoSegunHora,
} from "@/lib/calendario";

describe("meses", () => {
  test("nombre", () => {
    expect(nombreDeMes("2026-10")).toBe("octubre de 2026");
    expect(nombreDeMes("2026-01")).toBe("enero de 2026");
    expect(() => nombreDeMes("2026-13")).toThrow();
    expect(() => nombreDeMes("hola")).toThrow();
  });
  test.each([["2026-10", "2026-09", "2026-11"], ["2026-01", "2025-12", "2026-02"], ["2026-12", "2026-11", "2027-01"]])("%s: anterior %s, siguiente %s", (m, ant, sig) => {
    expect(mesAnterior(m)).toBe(ant);
    expect(mesSiguiente(m)).toBe(sig);
  });
  test("mesDe y mesesEntre", () => {
    expect(mesDe("2026-10-09")).toBe("2026-10");
    expect(mesesEntre("2026-10", "2027-01")).toBe(3);
    expect(mesesEntre("2026-10", "2025-10")).toBe(-12);
  });
  test.each([["2026-10", 31], ["2026-02", 28], ["2024-02", 29], ["2026-04", 30], ["2100-02", 28], ["2000-02", 29]])("%s tiene %i días", (m, n) => expect(diasDelMes(m)).toBe(n));
  test("rango del mes", () => expect(rangoDelMes("2026-02")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" }));
});

describe("leerMes y leerDia (lo que llega en la dirección)", () => {
  const hoy = "2026-10-09";
  test("mes válido cercano", () => expect(leerMes("2026-09", hoy)).toBe("2026-09"));
  test.each([[undefined], [null], [""], ["hola"], ["2026-13"], ["2026-00"], ["2026-9"], ["2026-10-09"], [["2026-09"]], [5], ["1999-01"], ["2040-01"], ["9999-12"]])("mes inválido o absurdo %j → mes de hoy", (v) => {
    expect(leerMes(v, hoy)).toBe("2026-10");
  });
  test("límite de 24 meses", () => {
    expect(leerMes("2028-10", hoy)).toBe("2028-10");
    expect(leerMes("2028-11", hoy)).toBe("2026-10");
    expect(leerMes("2024-10", hoy)).toBe("2024-10");
    expect(leerMes("2024-09", hoy)).toBe("2026-10");
  });
  test("día dentro del mes", () => expect(leerDia("2026-10-09", "2026-10")).toBe("2026-10-09"));
  test.each([[undefined], ["2026-10-32"], ["2026-02-30"], ["2026-09-30"], ["hola"], [""], [["2026-10-01"]]])("día inválido o de otro mes %j → null", (v) => {
    expect(leerDia(v, "2026-10")).toBeNull();
  });
});

describe("cuadrícula", () => {
  test("octubre 2026 empieza en jueves: 5 semanas, lunes a domingo", () => {
    const g = cuadriculaDelMes("2026-10");
    expect(g).toHaveLength(5);
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0][0]).toEqual({ dia: "2026-09-28", delMes: false });
    expect(g[0][3]).toEqual({ dia: "2026-10-01", delMes: true }); // jueves
    expect(g[4][6]).toEqual({ dia: "2026-11-01", delMes: false });
  });
  test("febrero 2027 (lunes a domingo exactos): 4 semanas sin días de otros meses", () => {
    const g = cuadriculaDelMes("2027-02");
    expect(g).toHaveLength(4);
    expect(g.flat().every((c) => c.delMes)).toBe(true);
  });
  test("un mes que ocupa 6 semanas (marzo 2025, empieza sábado)", () => expect(cuadriculaDelMes("2025-03")).toHaveLength(6));
  test("cada mes: todos sus días aparecen una sola vez y en orden", () => {
    for (const m of ["2024-02", "2026-02", "2026-10", "2026-12", "2027-01"]) {
      const dias = cuadriculaDelMes(m).flat().filter((c) => c.delMes).map((c) => c.dia);
      expect(dias).toHaveLength(diasDelMes(m));
      expect(new Set(dias).size).toBe(dias.length);
      expect([...dias].sort()).toEqual(dias);
    }
  });
  test("cruza años", () => {
    const g = cuadriculaDelMes("2026-01");
    expect(g[0][0].dia).toBe("2025-12-29");
  });
  test("día de la semana (0 = lunes)", () => {
    expect(indiceDeSemana("2026-10-05")).toBe(0);
    expect(indiceDeSemana("2026-10-09")).toBe(4); // viernes
    expect(indiceDeSemana("2026-10-11")).toBe(6); // domingo
    expect(() => indiceDeSemana("hola")).toThrow();
  });
});

describe("feriados fijos", () => {
  test.each([["2026-01-01", "Año Nuevo"], ["2026-05-25", "Revolución de Mayo"], ["2026-07-09", "Día de la Independencia"], ["2026-12-25", "Navidad"]])("%s → %s", (d, n) => expect(feriadoDe(d)).toBe(n));
  test("los trasladables NO figuran (podrían ser otro día)", () => {
    expect(feriadoDe("2026-08-17")).toBeNull(); // San Martín
    expect(feriadoDe("2026-10-12")).toBeNull(); // Diversidad Cultural
    expect(feriadoDe("2026-11-20")).toBeNull(); // Soberanía Nacional
  });
  test("un día común y una fecha inválida", () => {
    expect(feriadoDe("2026-10-09")).toBeNull();
    expect(feriadoDe("2026-02-30")).toBeNull();
  });
});

describe("saludo", () => {
  test.each([[0, "Buenas noches"], [5, "Buenas noches"], [6, "Buen día"], [12, "Buen día"], [13, "Buenas tardes"], [19, "Buenas tardes"], [20, "Buenas noches"], [23, "Buenas noches"]] as const)("%i h → %s", (h, s) => expect(saludoSegunHora(h)).toBe(s));
  test.each([[-1], [24], [1.5], [Number.NaN]])("hora inválida %s", (h) => expect(() => saludoSegunHora(h)).toThrow());
});
