import { describe, expect, test } from "vitest";
import {
  cantidadConCeroABase,
  contarPorEstado,
  diferenciaDeRecuento,
  estadoDeStock,
  filtrarStock,
  leerAjustesDelPeriodo,
  leerHistorial,
  leerValorInventario,
  mensajeDeErrorDeStock,
  MOTIVOS_AJUSTE,
  ordenarPorUrgencia,
  sinTildes,
  validarEdicionProducto,
  validarRecuento,
  type ItemStock,
} from "@/lib/stock";

const CLAVE = "a0000000-0000-4000-8000-000000000001";
const item = (id: number, nombre: string, stock: number, stockMinimo = 0, categoriaId = 1): ItemStock => ({ id, nombre, categoriaId, tipoVenta: "unidad", stock, stockMinimo });

describe("estadoDeStock", () => {
  test.each([
    [-1, 0, "negativo"], [-450, 5, "negativo"], [0, 0, "sin_stock"], [0, 10, "sin_stock"],
    [5, 5, "bajo"], [4, 5, "bajo"], [6, 5, "ok"], [1, 0, "ok"], [100, 0, "ok"],
  ] as const)("stock %i, mínimo %i → %s", (s, m, e) => expect(estadoDeStock(s, m)).toBe(e));

  test("sin mínimo cargado, nunca es «bajo»", () => expect(estadoDeStock(1, 0)).toBe("ok"));
});

describe("filtrar y ordenar", () => {
  const items = [item(1, "Jamón cocido", 10, 0, 1), item(2, "Queso", 0, 0, 2), item(3, "Gaseosa", 3, 5, 3), item(4, "Salame", -450, 0, 1), item(5, "Jamón crudo", 50, 0, 1)];

  test("búsqueda sin tildes ni mayúsculas", () => {
    expect(filtrarStock(items, { texto: "JAMON", categoriaId: null, estado: null }).map((i) => i.id)).toEqual([1, 5]);
    expect(sinTildes("Jamón")).toBe("jamon");
  });

  test("por categoría", () => expect(filtrarStock(items, { texto: "", categoriaId: 1, estado: null }).map((i) => i.id)).toEqual([1, 4, 5]));
  test("por estado", () => expect(filtrarStock(items, { texto: "", categoriaId: null, estado: "sin_stock" }).map((i) => i.id)).toEqual([2]));
  test("«atención» = todo lo que no está en orden", () => expect(filtrarStock(items, { texto: "", categoriaId: null, estado: "atencion" }).map((i) => i.id)).toEqual([2, 3, 4]));
  test("filtros combinados", () => expect(filtrarStock(items, { texto: "jam", categoriaId: 1, estado: "ok" }).map((i) => i.id)).toEqual([1, 5]));
  test("sin filtros devuelve todo y no modifica la lista", () => {
    expect(filtrarStock(items, { texto: "  ", categoriaId: null, estado: null })).toHaveLength(5);
  });

  test("orden por urgencia: negativo, sin stock, bajo, ok; y por nombre", () => {
    expect(ordenarPorUrgencia(items).map((i) => i.id)).toEqual([4, 2, 3, 1, 5]);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]); // el original no se toca
  });

  test("contarPorEstado", () => expect(contarPorEstado(items)).toEqual({ negativo: 1, sin_stock: 1, bajo: 1, ok: 2 }));
});

describe("cantidadConCeroABase", () => {
  test.each([["0", "unidad", 0], ["000", "unidad", 0], ["0", "peso", 0], ["0,0", "peso", 0], ["0,000", "peso", 0], ["12", "unidad", 12], ["2,5", "peso", 2500], ["0,5", "peso", 500]] as const)(
    "«%s» (%s) → %i",
    (t, tipo, esperado) => expect(cantidadConCeroABase(t, tipo)).toBe(esperado),
  );
  test.each([["", "unidad"], ["1.5", "peso"], ["abc", "peso"], ["-1", "unidad"], ["1001", "peso"], ["100001", "unidad"], ["0,0001", "peso"], ["1,5", "unidad"]] as const)("«%s» (%s) se rechaza", (t, tipo) => {
    expect(() => cantidadConCeroABase(t, tipo)).toThrow();
  });
});

describe("diferenciaDeRecuento", () => {
  test("coincide", () => expect(diferenciaDeRecuento(10, 10, "unidad")).toMatchObject({ delta: 0, tipo: "coincide" }));
  test("faltan", () => expect(diferenciaDeRecuento(10000, 9500, "peso")).toMatchObject({ delta: -500, tipo: "faltan", texto: "Faltan 500 g respecto del sistema." }));
  test("sobran", () => expect(diferenciaDeRecuento(24, 30, "unidad")).toMatchObject({ delta: 6, tipo: "sobran", texto: "Sobran 6 u. respecto del sistema." }));
  test("desde stock negativo", () => expect(diferenciaDeRecuento(-450, 0, "peso")).toMatchObject({ delta: 450, tipo: "sobran" }));
});

describe("validarRecuento", () => {
  const base = { productoId: "7", contado: "0,5", motivo: "Recuento físico", detalle: "", clave: CLAVE };
  const ok = (extra: Record<string, unknown> = {}, tipo: "peso" | "unidad" | null = "peso") => validarRecuento({ ...base, ...extra }, tipo);
  const errores = (extra: Record<string, unknown>, tipo: "peso" | "unidad" | null = "peso") => {
    const r = ok(extra, tipo);
    if (r.ok) throw new Error("debía fallar");
    return r.errores;
  };

  test("válido por peso y por unidad", () => {
    expect(ok()).toEqual({ ok: true, valores: { productoId: 7, contado: 500, motivo: "Recuento físico", clave: CLAVE } });
    expect(ok({ contado: "12" }, "unidad")).toMatchObject({ ok: true, valores: { contado: 12 } });
  });

  test("contar CERO es válido (no queda nada)", () => expect(ok({ contado: "0" })).toMatchObject({ ok: true, valores: { contado: 0 } }));
  test("campo vacío NO es cero: pide escribirlo", () => expect(errores({ contado: "" }).contado).toMatch(/poné 0/));
  test("punto en kilos: pide coma", () => expect(errores({ contado: "1.5" }).contado).toMatch(/coma/));
  test("tope por recuento", () => expect(errores({ contado: "1001" }).contado).toMatch(/por recuento/));
  test("motivo obligatorio y de la lista", () => {
    expect(errores({ motivo: "" }).motivo).toBeDefined();
    expect(errores({ motivo: "Porque sí" }).motivo).toBeDefined();
    for (const m of MOTIVOS_AJUSTE) expect(ok({ motivo: m, detalle: "x" }).ok).toBe(true);
  });
  test("«Otro motivo» exige detalle; el detalle se suma al motivo", () => {
    expect(errores({ motivo: "Otro motivo" }).detalle).toMatch(/qué pasó/);
    expect(ok({ detalle: " lote del lunes " })).toMatchObject({ valores: { motivo: "Recuento físico: lote del lunes" } });
    expect(errores({ detalle: "a".repeat(121) }).detalle).toBeDefined();
  });
  test("producto desconocido o clave inválida", () => {
    expect(errores({}, null).productoId).toBeDefined();
    expect(errores({ productoId: "abc" }).productoId).toBeDefined();
    expect(errores({ clave: "no" }).clave).toBeDefined();
  });
});

describe("validarEdicionProducto", () => {
  const base = { nombre: "  Jamón   cocido ", categoriaId: "2", codigo: "JAM-01", stockMinimo: "2", precio: "22.000" };

  test("válido: normaliza y convierte (peso: mínimo en kilos → gramos)", () => {
    expect(validarEdicionProducto(base, "peso")).toEqual({
      ok: true,
      valores: { categoriaId: 2, nombre: "Jamón cocido", codigo: "JAM-01", tipoVenta: "peso", precioCentavos: 2_200_000, stockMinimo: 2000 },
    });
  });

  test("por unidad: el mínimo son unidades", () => {
    expect(validarEdicionProducto({ ...base, stockMinimo: "12" }, "unidad")).toMatchObject({ ok: true, valores: { stockMinimo: 12, tipoVenta: "unidad" } });
  });

  test("mínimo vacío o cero = sin mínimo", () => {
    expect(validarEdicionProducto({ ...base, stockMinimo: "" }, "peso")).toMatchObject({ ok: true, valores: { stockMinimo: 0 } });
    expect(validarEdicionProducto({ ...base, stockMinimo: "0" }, "peso")).toMatchObject({ ok: true, valores: { stockMinimo: 0 } });
  });

  test("el tipo de venta que mande el navegador se IGNORA: manda el de la base", () => {
    const r = validarEdicionProducto({ ...base, tipoVenta: "unidad", stockMinimo: "2" }, "peso");
    expect(r).toMatchObject({ ok: true, valores: { tipoVenta: "peso", stockMinimo: 2000 } });
  });

  test("errores por campo, todos juntos", () => {
    const r = validarEdicionProducto({ nombre: "", categoriaId: "", codigo: "!!", stockMinimo: "1.5", precio: "abc" }, "peso");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["categoriaId", "codigo", "nombre", "precio", "stockMinimo"]);
  });

  test("producto inexistente o archivado", () => {
    const r = validarEdicionProducto(base, null);
    expect(r.ok).toBe(false);
  });

  test("precio cero se rechaza", () => {
    const r = validarEdicionProducto({ ...base, precio: "0" }, "peso");
    expect(!r.ok && r.errores.precio).toBeDefined();
  });
});

describe("mensajeDeErrorDeStock", () => {
  test.each([
    [{ code: "42501" }, /permiso/], [{ message: "solo_dueno" }, /permiso/], [{ message: "producto_no_encontrado" }, /archivado/],
    [{ code: "23505", message: 'violates unique constraint "productos_nombre_por_categoria_unico"' }, /nombre en esa categoría/],
    [{ code: "23505", message: "productos_codigo_key (codigo)" }, /código/], [{ code: "23503" }, /categoría/],
    [{ message: "minimo_invalido" }, /mínimo/], [{ message: "precio_invalido" }, /precio/], [{ message: "fetch failed" }, /conectar/],
  ])("%j", (e, esperado) => expect(mensajeDeErrorDeStock(e, "guardar")).toMatch(esperado));

  test("lo desconocido no filtra detalles internos", () => {
    expect(mensajeDeErrorDeStock({ message: "relation x violates ..." }, "guardar el recuento")).toBe("No se pudo guardar el recuento. Intentá de nuevo.");
  });
});

describe("lecturas de la base", () => {
  test("valor del inventario: una sola fila de enteros", () => {
    const f = { valor_centavos: 9_500_000, con_costo: 1, sin_costo: 2 };
    expect(leerValorInventario([f])).toEqual(f);
    expect(leerValorInventario([])).toBeNull();
    expect(leerValorInventario([{ ...f, valor_centavos: -1 }])).toBeNull();
    expect(leerValorInventario(null)).toBeNull();
  });

  const h = { id: 1, tipo: "ajuste", cantidad: -500, saldo: 9500, motivo: "Recuento físico", usuario: "Dueño", creado_en: "2026-10-09T23:00:00Z" };
  test("historial: acepta cantidades negativas y motivo nulo", () => {
    expect(leerHistorial([h])).toEqual([h]);
    expect(leerHistorial([{ ...h, motivo: null, tipo: "venta" }])).toHaveLength(1);
    expect(leerHistorial([{ ...h, saldo: -450 }])).toHaveLength(1);
  });
  test.each([[{ tipo: "robo" }], [{ cantidad: 1.5 }], [{ usuario: 5 }], [{ saldo: "9" }]])("historial rechaza %j", (cambio) => {
    expect(leerHistorial([{ ...h, ...cambio }])).toBeNull();
  });

  test("ajustes del período", () => {
    const f = { faltante_centavos: 1, sobrante_centavos: 2, ajustes: 3, sin_costo: 0 };
    expect(leerAjustesDelPeriodo([f])).toEqual(f);
    expect(leerAjustesDelPeriodo([f, f])).toBeNull();
    expect(leerAjustesDelPeriodo([{ ...f, ajustes: -1 }])).toBeNull();
  });
});
