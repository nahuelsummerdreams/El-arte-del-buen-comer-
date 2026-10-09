import { describe, expect, test } from "vitest";
import { validarContrasenaNueva, CONTRASENA_MIN, CONTRASENA_MAX } from "@/lib/contrasena";

const ok = { actual: "8qGeEqQ9QZVeze", nueva: "Mi fiambreria 2026", repetir: "Mi fiambreria 2026" };

function errores(cambio: Record<string, unknown>) {
  const r = validarContrasenaNueva({ ...ok, ...cambio });
  if (r.ok) throw new Error("se esperaba un error");
  return r.errores;
}

describe("validarContrasenaNueva · datos correctos", () => {
  test("acepta una contraseña razonable", () => {
    expect(validarContrasenaNueva(ok)).toEqual({ ok: true, valores: { actual: ok.actual, nueva: ok.nueva } });
  });

  test("acepta frases con espacios (más fáciles de recordar que una clave rara)", () => {
    expect(validarContrasenaNueva({ ...ok, nueva: "jamon y queso del barrio", repetir: "jamon y queso del barrio" }).ok).toBe(true);
  });

  test("NO recorta espacios: son parte de la contraseña", () => {
    const r = validarContrasenaNueva({ ...ok, nueva: " abcdefghij ", repetir: " abcdefghij " });
    expect(r.ok && r.valores.nueva).toBe(" abcdefghij ");
  });

  test("el largo mínimo es 10 y el máximo 72 (límite real del cifrado bcrypt)", () => {
    expect(CONTRASENA_MIN).toBe(10);
    expect(CONTRASENA_MAX).toBe(72);
    expect(validarContrasenaNueva({ ...ok, nueva: "a1".repeat(5), repetir: "a1".repeat(5) }).ok).toBe(true);
    expect(validarContrasenaNueva({ ...ok, nueva: "ab".repeat(36), repetir: "ab".repeat(36) }).ok).toBe(true);
  });
});

describe("validarContrasenaNueva · rechazos", () => {
  test("falta la contraseña actual", () => expect(errores({ actual: "" }).actual).toBeDefined());
  test("la actual no es texto", () => expect(errores({ actual: null }).actual).toBeDefined());

  test("nueva demasiado corta (9 caracteres)", () =>
    expect(errores({ nueva: "abcdefgh1", repetir: "abcdefgh1" }).nueva).toMatch(/10/));
  test("nueva demasiado larga (73 caracteres)", () =>
    expect(errores({ nueva: "a".repeat(73), repetir: "a".repeat(73) }).nueva).toMatch(/72/));
  test("solo números", () => expect(errores({ nueva: "1234567890", repetir: "1234567890" }).nueva).toMatch(/solo números/i));
  test("un solo carácter repetido", () =>
    expect(errores({ nueva: "aaaaaaaaaaaa", repetir: "aaaaaaaaaaaa" }).nueva).toBeDefined());
  test("igual a la actual", () =>
    expect(errores({ nueva: ok.actual, repetir: ok.actual }).nueva).toMatch(/distinta/i));

  test("la repetición no coincide", () => expect(errores({ repetir: "otra cosa distinta" }).repetir).toMatch(/coincid/i));
  test("repetición vacía", () => expect(errores({ repetir: "" }).repetir).toBeDefined());

  test("informa todos los errores a la vez", () => {
    const e = errores({ actual: "", nueva: "corta", repetir: "otra" });
    expect(Object.keys(e).sort()).toEqual(["actual", "nueva", "repetir"]);
  });

  test("los mensajes de error NUNCA incluyen la contraseña escrita", () => {
    const e = errores({ nueva: "secreta1", repetir: "secreta2" });
    expect(JSON.stringify(e)).not.toContain("secreta");
  });
});
