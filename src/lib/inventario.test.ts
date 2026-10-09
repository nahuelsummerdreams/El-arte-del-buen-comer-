import { describe, expect, test } from "vitest";
import {
  cantidadABase,
  MOTIVOS_MERMA,
  mensajeDeErrorAlRegistrarIngreso,
  mensajeDeErrorAlRegistrarMerma,
  validarMerma,
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

const SIN_EXTRAS = { costoTotalCentavos: null, venceEl: null, proveedorId: null, pagado: true, pagarHasta: null };

describe("validarIngreso · datos correctos", () => {
  test("devuelve valores convertidos (producto numérico, cantidad en gramos)", () => {
    expect(
      validarIngreso({ productoId: "7", cantidad: "2,5", nota: "  Remito 0001-123  ", clave: CLAVE }, "peso"),
    ).toEqual({ ok: true, valores: { ...SIN_EXTRAS, productoId: 7, cantidad: 2500, nota: "Remito 0001-123", clave: CLAVE } });
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

describe("validarIngreso · costo, vencimiento, proveedor y pago", () => {
  const HOY = "2026-10-09";
  const base = { productoId: "7", cantidad: "10", clave: CLAVE };
  const ok = (extra: Record<string, unknown>) => {
    const r = validarIngreso({ ...base, ...extra }, "peso", HOY);
    if (!r.ok) throw new Error(JSON.stringify(r.errores));
    return r.valores;
  };
  const errores = (extra: Record<string, unknown>) => {
    const r = validarIngreso({ ...base, ...extra }, "peso", HOY);
    if (r.ok) throw new Error("debía fallar");
    return r.errores;
  };

  test("todo opcional: sin costo, sin vencimiento, sin proveedor, pagado", () => {
    expect(ok({})).toMatchObject(SIN_EXTRAS);
  });

  test("costo total en pesos → centavos", () => {
    expect(ok({ costoTotal: "80.000" }).costoTotalCentavos).toBe(8_000_000);
    expect(ok({ costoTotal: "1250,50" }).costoTotalCentavos).toBe(125_050);
    expect(ok({ costoTotal: "0" }).costoTotalCentavos).toBe(0); // mercadería regalada
    expect(ok({ costoTotal: "   " }).costoTotalCentavos).toBeNull();
  });

  test.each([["abc"], ["-5"], ["1,5,5"], ["99999999999"]])("costo inválido «%s»", (c) => {
    expect(errores({ costoTotal: c }).costoTotal).toBeDefined();
  });

  test("vencimiento: hoy y futuro sí; ayer no", () => {
    expect(ok({ vence: "2026-10-09" }).venceEl).toBe("2026-10-09");
    expect(ok({ vence: "2026-12-31" }).venceEl).toBe("2026-12-31");
    expect(errores({ vence: "2026-10-08" }).vence).toMatch(/ya pasó/);
  });

  test.each([["09/10/2026"], ["2026-13-01"], ["2026-02-30"], ["hola"], ["2026-10-9"]])("vencimiento inválido «%s»", (v) => {
    expect(errores({ vence: v }).vence).toBe("Fecha inválida.");
  });

  test("vencimiento a más de 10 años: error", () => {
    expect(errores({ vence: "2036-10-07" }).vence).toMatch(/lejos/); // 3.650 días: el mismo límite que la base
    expect(ok({ vence: "2036-10-06" }).venceEl).toBe("2036-10-06");
  });

  test("proveedor: número o vacío", () => {
    expect(ok({ proveedorId: "3" }).proveedorId).toBe(3);
    expect(ok({ proveedorId: "" }).proveedorId).toBeNull();
    expect(errores({ proveedorId: "abc" }).proveedorId).toBeDefined();
    expect(errores({ proveedorId: "0" }).proveedorId).toBeDefined();
    expect(errores({ proveedorId: "-2" }).proveedorId).toBeDefined();
  });

  test("a cuenta (pagado = no): exige costo y acepta fecha de pago", () => {
    const v = ok({ pagado: "no", costoTotal: "5000", pagarHasta: "2026-10-20" });
    expect(v.pagado).toBe(false);
    expect(v.pagarHasta).toBe("2026-10-20");
    expect(errores({ pagado: "no" }).costoTotal).toMatch(/deuda/i);
    expect(errores({ pagado: "no", costoTotal: "5000", pagarHasta: "2026-10-01" }).pagarHasta).toMatch(/ya pasó/);
  });

  test("si está pagado, la fecha de pago se ignora", () => {
    const v = ok({ pagado: "si", costoTotal: "100", pagarHasta: "2026-10-20" });
    expect(v.pagado).toBe(true);
    expect(v.pagarHasta).toBeNull();
  });

  test("valor raro en pagado: error", () => {
    expect(errores({ pagado: "quizás" }).pagado).toBeDefined();
  });

  test("informa errores de varios campos nuevos a la vez", () => {
    const e = errores({ costoTotal: "x", vence: "2020-01-01", proveedorId: "z" });
    expect(Object.keys(e).sort()).toEqual(["costoTotal", "proveedorId", "vence"]);
  });
});

describe("mensajeDeErrorAlRegistrarIngreso · errores de las reglas nuevas", () => {
  test.each([
    ["solo_dueno", /permiso/],
    ["producto_no_encontrado", /no existe/],
    ["proveedor_no_encontrado", /proveedor/],
    ["vencimiento_pasado", /vencimiento/],
    ["costo_fuera_de_rango", /demasiado grande/],
    ["deuda_sin_costo", /deuda/],
  ])("%s", (m, esperado) => {
    expect(mensajeDeErrorAlRegistrarIngreso({ message: m })).toMatch(esperado);
  });
  test("no filtra detalles internos", () => {
    expect(mensajeDeErrorAlRegistrarIngreso({ message: "relation lotes_stock violates ..." })).toBe("No se pudo registrar el ingreso. Intentá de nuevo.");
  });
});

describe("validarMerma · registrar una pérdida", () => {
  const base = { productoId: "7", cantidad: "0,5", motivo: "Vencido", detalle: "", clave: CLAVE };
  const ok = (extra: Record<string, unknown> = {}, tipo: "peso" | "unidad" | null = "peso") => validarMerma({ ...base, ...extra }, tipo);

  test("pérdida válida por peso: kilos con coma → gramos", () => {
    expect(ok()).toEqual({ ok: true, valores: { productoId: 7, cantidad: 500, motivo: "Vencido", clave: CLAVE } });
  });

  test("por unidad", () => {
    const r = ok({ cantidad: "3" }, "unidad");
    expect(r.ok && r.valores.cantidad).toBe(3);
  });

  test("el detalle se suma al motivo", () => {
    const r = ok({ detalle: "  lote del lunes " });
    expect(r.ok && r.valores.motivo).toBe("Vencido: lote del lunes");
  });

  test("«Otro motivo» exige contar qué pasó", () => {
    const r = ok({ motivo: "Otro motivo" });
    expect(!r.ok && r.errores.detalle).toMatch(/qué pasó/i);
    expect(ok({ motivo: "Otro motivo", detalle: "se cayó" }).ok).toBe(true);
  });

  test.each([[""], ["Porque sí"], ["vencido"], ["<b>x</b>"]])("motivo fuera de la lista «%s» se rechaza", (m) => {
    const r = ok({ motivo: m });
    expect(!r.ok && r.errores.motivo).toBeDefined();
  });

  test("todos los motivos de la lista son aceptados", () => {
    for (const m of MOTIVOS_MERMA) expect(ok({ motivo: m, detalle: "x" }).ok).toBe(true);
  });

  test("cantidad: mismos controles que el ingreso, con mensaje propio", () => {
    expect(!ok({ cantidad: "" }).ok).toBe(true);
    const punto = ok({ cantidad: "1.5" });
    expect(!punto.ok && punto.errores.cantidad).toMatch(/coma/);
    const grande = ok({ cantidad: "1001" });
    expect(!grande.ok && grande.errores.cantidad).toMatch(/por registro/);
    expect(!ok({ cantidad: "0" }).ok).toBe(true);
  });

  test("producto inexistente o sin elegir", () => {
    const sin = ok({ productoId: "" });
    expect(!sin.ok && sin.errores.productoId).toBeDefined();
    const noExiste = ok({}, null);
    expect(!noExiste.ok && noExiste.errores.productoId).toBeDefined();
    expect(!noExiste.ok && noExiste.errores.cantidad).toBeUndefined();
  });

  test("detalle largo y clave inválida", () => {
    const largo = ok({ detalle: "a".repeat(121) });
    expect(!largo.ok && largo.errores.detalle).toBeDefined();
    const clave = ok({ clave: "nope" });
    expect(!clave.ok && clave.errores.clave).toBeDefined();
  });

  test("mensajes de error de la base", () => {
    expect(mensajeDeErrorAlRegistrarMerma({ message: "solo_dueno" })).toMatch(/permiso/);
    expect(mensajeDeErrorAlRegistrarMerma({ message: "producto_no_encontrado" })).toMatch(/no existe/);
    expect(mensajeDeErrorAlRegistrarMerma({ message: "boom" })).toBe("No se pudo registrar la pérdida. Intentá de nuevo.");
  });
});
