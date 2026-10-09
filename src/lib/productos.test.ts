import { describe, expect, test } from "vitest";
import { mensajeDeErrorAlGuardar, validarProducto } from "@/lib/productos";

const valido = {
  categoriaId: "1",
  nombre: "Jamón cocido",
  codigo: "",
  tipoVenta: "peso",
  precio: "20.000,50",
};

function errores(entrada: Record<string, unknown>) {
  const r = validarProducto(entrada);
  if (r.ok) throw new Error("Se esperaba que la validación fallara");
  return r.errores;
}

describe("validarProducto · datos correctos", () => {
  test("devuelve los valores ya convertidos (precio en centavos, categoría numérica)", () => {
    expect(validarProducto(valido)).toEqual({
      ok: true,
      valores: {
        categoriaId: 1,
        nombre: "Jamón cocido",
        codigo: null,
        tipoVenta: "peso",
        precioCentavos: 2_000_050,
      },
    });
  });

  test("recorta espacios y junta los espacios repetidos del nombre", () => {
    const r = validarProducto({ ...valido, nombre: "   Queso   de   máquina  " });
    expect(r.ok && r.valores.nombre).toBe("Queso de máquina");
  });

  test("el código es opcional: vacío o solo espacios → null", () => {
    expect(validarProducto({ ...valido, codigo: "   " }).ok && true).toBe(true);
    const r = validarProducto({ ...valido, codigo: "   " });
    expect(r.ok && r.valores.codigo).toBeNull();
  });

  test("conserva un código válido", () => {
    const r = validarProducto({ ...valido, codigo: " 7790-ABC_01/2 " });
    expect(r.ok && r.valores.codigo).toBe("7790-ABC_01/2");
  });

  test("acepta tipo unidad", () => {
    const r = validarProducto({ ...valido, tipoVenta: "unidad", precio: "3.500" });
    expect(r.ok && r.valores.tipoVenta).toBe("unidad");
    expect(r.ok && r.valores.precioCentavos).toBe(350_000);
  });
});

describe("validarProducto · nombre", () => {
  test("vacío", () => expect(errores({ ...valido, nombre: "   " }).nombre).toMatch(/nombre/i));
  test("muy corto (1 letra)", () => expect(errores({ ...valido, nombre: "a" }).nombre).toBeDefined());
  test("muy largo (81 caracteres)", () =>
    expect(errores({ ...valido, nombre: "a".repeat(81) }).nombre).toBeDefined());
  test("80 caracteres es el máximo permitido", () =>
    expect(validarProducto({ ...valido, nombre: "a".repeat(80) }).ok).toBe(true));
  test("no es texto", () => expect(errores({ ...valido, nombre: null }).nombre).toBeDefined());
});

describe("validarProducto · categoría", () => {
  test.each([["vacía", ""], ["letras", "abc"], ["cero", "0"], ["negativa", "-3"], ["decimal", "1.5"], ["nula", null], ["notación científica", "1e3"]])(
    "%s",
    (_n, valor) => expect(errores({ ...valido, categoriaId: valor }).categoriaId).toBeDefined(),
  );
});

describe("validarProducto · tipo de venta", () => {
  test.each([["vacío", ""], ["inventado", "litro"], ["con mayúscula", "Peso"], ["nulo", null]])("%s", (_n, valor) =>
    expect(errores({ ...valido, tipoVenta: valor }).tipoVenta).toBeDefined(),
  );
});

describe("validarProducto · precio", () => {
  test("vacío pide escribirlo", () => expect(errores({ ...valido, precio: "" }).precio).toMatch(/precio/i));
  test("inválido da un ejemplo de cómo escribirlo", () =>
    expect(errores({ ...valido, precio: "abc" }).precio).toMatch(/20\.000,50/));
  test("cero no se permite en un producto nuevo", () =>
    expect(errores({ ...valido, precio: "0" }).precio).toMatch(/mayor a cero/i));
  test("negativo", () => expect(errores({ ...valido, precio: "-5" }).precio).toBeDefined());
  test("demasiado grande para la base de datos", () =>
    expect(errores({ ...valido, precio: "21.474.836,48" }).precio).toBeDefined());
  test("ambiguo (1,000.50) se rechaza", () => expect(errores({ ...valido, precio: "1,000.50" }).precio).toBeDefined());
});

describe("validarProducto · código", () => {
  test("rechaza caracteres raros", () => expect(errores({ ...valido, codigo: "abc;drop" }).codigo).toBeDefined());
  test("rechaza más de 40 caracteres", () => expect(errores({ ...valido, codigo: "1".repeat(41) }).codigo).toBeDefined());
});

describe("validarProducto · varios errores a la vez", () => {
  test("informa TODOS los campos con error, no solo el primero", () => {
    const e = errores({ categoriaId: "", nombre: "", codigo: "", tipoVenta: "", precio: "" });
    expect(Object.keys(e).sort()).toEqual(["categoriaId", "nombre", "precio", "tipoVenta"]);
  });
});

describe("mensajeDeErrorAlGuardar · traduce errores de la base a mensajes para personas", () => {
  test("nombre repetido en la categoría", () => {
    const m = mensajeDeErrorAlGuardar({
      code: "23505",
      message: 'duplicate key value violates unique constraint "productos_nombre_por_categoria_unico"',
    });
    expect(m).toMatch(/nombre/i);
  });

  test("código repetido", () => {
    const m = mensajeDeErrorAlGuardar({
      code: "23505",
      message: 'duplicate key value violates unique constraint "productos_codigo_key"',
    });
    expect(m).toMatch(/código/i);
  });

  test("otro duplicado", () => {
    expect(mensajeDeErrorAlGuardar({ code: "23505", message: "otra cosa" })).toMatch(/ya existe/i);
  });

  test("sin permiso (RLS)", () => {
    expect(mensajeDeErrorAlGuardar({ code: "42501", message: "new row violates row-level security policy" })).toMatch(
      /permiso/i,
    );
  });

  test("categoría inexistente", () => {
    expect(mensajeDeErrorAlGuardar({ code: "23503", message: "violates foreign key constraint" })).toMatch(
      /categoría/i,
    );
  });

  test("falla de red", () => {
    expect(mensajeDeErrorAlGuardar({ code: "", message: "TypeError: fetch failed" })).toMatch(/conectar/i);
  });

  test("cualquier otra cosa → mensaje genérico que NO expone detalles internos de la base", () => {
    const m = mensajeDeErrorAlGuardar({ code: "XX000", message: 'relation "secreta" does not exist' });
    expect(m).toBe("No se pudo guardar el producto. Intentá de nuevo.");
    expect(m).not.toContain("secreta");
  });
});
