import { describe, expect, test } from "vitest";
import {
  cantidadABase,
  mensajeDeErrorAlRegistrarIngreso,
  validarIngreso,
  MAX_GRAMOS_POR_INGRESO,
  MAX_UNIDADES_POR_INGRESO,
} from "@/lib/inventario";

const CLAVE = "3f2b8c1e-5a7d-4e90-9c1b-0a1b2c3d4e5f";

describe("cantidadABase · productos por peso: kilos con coma → gramos", () => {
  test.each([
    ["2", 2000],
    ["2,5", 2500],
    ["2,50", 2500],
    ["0,25", 250],
    ["0,250", 250],
    ["2,005", 2005],
    ["0,001", 1],
    ["  1,5  ", 1500],
    ["1000", 1_000_000], // el máximo exacto
  ])("«%s» kg → %i g", (texto, gramos) => {
    expect(cantidadABase(texto, "peso")).toBe(gramos);
  });

  test.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["letras", "abc"],
    ["con punto decimal (ambiguo: 2.5 o 2500)", "2.5"],
    ["con punto de miles", "2.500"],
    ["cuatro decimales", "1,2345"],
    ["coma sin decimales", "2,"],
    ["sin parte entera", ",5"],
    ["dos comas", "1,2,3"],
    ["negativo", "-2"],
    ["cero", "0"],
    ["cero con decimales", "0,000"],
    ["notación científica", "1e3"],
    ["más del máximo (1000,001 kg)", "1000,001"],
    ["absurdamente grande", "99999999999"],
  ])("rechaza %s: «%s»", (_n, texto) => {
    expect(() => cantidadABase(texto, "peso")).toThrow();
  });

  test("el máximo por ingreso es 1.000 kg", () => {
    expect(MAX_GRAMOS_POR_INGRESO).toBe(1_000_000);
  });

  test("el mensaje de error del punto explica qué hacer", () => {
    expect(() => cantidadABase("2.5", "peso")).toThrow(/coma/i);
  });
});

describe("cantidadABase · productos por unidad: entero", () => {
  test.each([
    ["1", 1],
    ["12", 12],
    ["  24 ", 24],
    ["100000", 100_000],
  ])("«%s» → %i unidades", (texto, unidades) => {
    expect(cantidadABase(texto, "unidad")).toBe(unidades);
  });

  test.each([
    ["vacío", ""],
    ["decimal con coma", "1,5"],
    ["decimal con punto", "1.5"],
    ["letras", "doce"],
    ["cero", "0"],
    ["negativo", "-3"],
    ["más del máximo", "100001"],
  ])("rechaza %s: «%s»", (_n, texto) => {
    expect(() => cantidadABase(texto, "unidad")).toThrow();
  });

  test("el máximo por ingreso es 100.000 unidades", () => {
    expect(MAX_UNIDADES_POR_INGRESO).toBe(100_000);
  });
});

describe("validarIngreso · datos correctos", () => {
  test("devuelve valores convertidos (producto numérico, cantidad en gramos)", () => {
    expect(
      validarIngreso({ productoId: "7", cantidad: "2,5", nota: "  Remito 0001-123  ", clave: CLAVE }, "peso"),
    ).toEqual({ ok: true, valores: { productoId: 7, cantidad: 2500, nota: "Remito 0001-123", clave: CLAVE } });
  });

  test("la nota es opcional: vacía → null", () => {
    const r = validarIngreso({ productoId: "7", cantidad: "12", nota: "   ", clave: CLAVE }, "unidad");
    expect(r.ok && r.valores.nota).toBeNull();
  });

  test("acepta la clave en mayúsculas y la normaliza a minúsculas", () => {
    const r = validarIngreso({ productoId: "7", cantidad: "1", nota: "", clave: CLAVE.toUpperCase() }, "unidad");
    expect(r.ok && r.valores.clave).toBe(CLAVE);
  });
});

describe("validarIngreso · errores por campo", () => {
  const base = { productoId: "7", cantidad: "2,5", nota: "", clave: CLAVE };
  const errores = (cambio: Record<string, unknown>, tipo: "peso" | "unidad" | null = "peso") => {
    const r = validarIngreso({ ...base, ...cambio }, tipo);
    if (r.ok) throw new Error("se esperaba un error");
    return r.errores;
  };

  test.each([["vacío", ""], ["letras", "x"], ["cero", "0"], ["negativo", "-1"], ["nulo", null]])(
    "producto %s",
    (_n, valor) => expect(errores({ productoId: valor }).productoId).toBeDefined(),
  );

  test("producto que no existe o está inactivo (tipo desconocido)", () => {
    expect(errores({}, null).productoId).toMatch(/producto/i);
  });

  test("cantidad vacía pide escribirla", () => expect(errores({ cantidad: "" }).cantidad).toMatch(/cantidad/i));
  test("cantidad inválida para peso da un ejemplo en kilos", () =>
    expect(errores({ cantidad: "abc" }).cantidad).toMatch(/2,5/));
  test("cantidad inválida para unidad da un ejemplo en unidades", () =>
    expect(errores({ cantidad: "1,5" }, "unidad").cantidad).toMatch(/entero/i));
  test("el punto en kilos se rechaza con un mensaje que dice QUÉ hacer (usar coma)", () => {
    expect(errores({ cantidad: "2.5" }).cantidad).toMatch(/Usá coma/);
    expect(errores({ cantidad: "2.500" }).cantidad).toMatch(/Usá coma/);
  });
  test("cantidad cero", () => expect(errores({ cantidad: "0" }).cantidad).toMatch(/mayor a cero/i));
  test("cantidad demasiado grande (peso)", () => expect(errores({ cantidad: "1001" }).cantidad).toMatch(/1\.000 kg/));
  test("cantidad demasiado grande (unidad)", () =>
    expect(errores({ cantidad: "100001" }, "unidad").cantidad).toMatch(/100\.000/));

  test("nota de más de 200 caracteres", () => expect(errores({ nota: "a".repeat(201) }).nota).toBeDefined());
  test("nota de 200 caracteres es válida", () =>
    expect(validarIngreso({ ...base, nota: "a".repeat(200) }, "peso").ok).toBe(true));

  test.each([["vacía", ""], ["no es un UUID", "12345"], ["con basura", CLAVE + "x"], ["nula", null]])(
    "clave %s",
    (_n, valor) => expect(errores({ clave: valor }).clave).toBeDefined(),
  );

  test("informa todos los errores a la vez", () => {
    const e = errores({ productoId: "", cantidad: "", nota: "a".repeat(300), clave: "" });
    expect(Object.keys(e).sort()).toEqual(["cantidad", "clave", "nota", "productoId"]);
  });
});

describe("mensajeDeErrorAlRegistrarIngreso", () => {
  test("sin permiso", () =>
    expect(mensajeDeErrorAlRegistrarIngreso({ code: "42501", message: "new row violates row-level security" })).toMatch(
      /permiso/i,
    ));
  test("producto inexistente", () =>
    expect(mensajeDeErrorAlRegistrarIngreso({ code: "23503", message: "foreign key" })).toMatch(/producto/i));
  test("falla de red", () =>
    expect(mensajeDeErrorAlRegistrarIngreso({ code: "", message: "TypeError: fetch failed" })).toMatch(/conectar/i));
  test("lo demás: genérico y sin detalles internos", () => {
    const m = mensajeDeErrorAlRegistrarIngreso({ code: "XX000", message: 'relation "secreta" does not exist' });
    expect(m).toBe("No se pudo registrar el ingreso. Intentá de nuevo.");
    expect(m).not.toContain("secreta");
  });
});
