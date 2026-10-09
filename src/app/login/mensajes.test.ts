import { describe, expect, test } from "vitest";
import { mensajeDeErrorDeLogin } from "./mensajes";

describe("mensajeDeErrorDeLogin", () => {
  test("credenciales incorrectas → culpa a las credenciales (y solo en ese caso)", () => {
    expect(mensajeDeErrorDeLogin({ code: "invalid_credentials", status: 400 })).toBe(
      "Email o contraseña incorrectos.",
    );
  });

  test("falla de red → NO culpa a la contraseña", () => {
    const msg = mensajeDeErrorDeLogin({ name: "AuthRetryableFetchError", status: 0 });
    expect(msg).toContain("conectar");
    expect(msg).not.toContain("contraseña");
  });

  test("status 0 también se trata como falla de conexión", () => {
    expect(mensajeDeErrorDeLogin({ status: 0 })).toContain("conectar");
  });

  test.each([500, 502, 503])("error del servidor (%i) → mensaje de problema del servidor", (status) => {
    const msg = mensajeDeErrorDeLogin({ status });
    expect(msg).toContain("servidor");
    expect(msg).not.toContain("contraseña");
  });

  test("demasiados intentos → pide esperar", () => {
    expect(mensajeDeErrorDeLogin({ code: "over_request_rate_limit", status: 429 })).toContain("Esperá");
  });

  test("email sin confirmar → lo dice", () => {
    expect(mensajeDeErrorDeLogin({ code: "email_not_confirmed", status: 400 })).toContain("confirm");
  });

  test("error desconocido → mensaje genérico, sin acusar a nadie", () => {
    const msg = mensajeDeErrorDeLogin({ code: "algo_nuevo", status: 418 });
    expect(msg).toBe("No se pudo iniciar sesión. Intentá de nuevo.");
  });

  test("error sin ningún dato → mensaje genérico", () => {
    expect(mensajeDeErrorDeLogin({})).toBe("No se pudo iniciar sesión. Intentá de nuevo.");
  });
});
