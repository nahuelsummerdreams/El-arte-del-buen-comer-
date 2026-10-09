import { describe, expect, test } from "vitest";
import { formatearRespuesta, segmentar } from "@/lib/asistente/formato";

const plano = (s: ReturnType<typeof segmentar>) => s.map((x) => (x.negrita ? `[${x.texto}]` : x.texto)).join("");

describe("segmentar", () => {
  test.each([
    ["hola", "hola"],
    ["hoy vendiste **$ 4.700,00** en total", "hoy vendiste [$ 4.700,00] en total"],
    ["**uno** y **dos**", "[uno] y [dos]"],
    ["**sin cerrar", "**sin cerrar"],
    ["a ** b", "a ** b"],
    ["", ""],
  ])("«%s»", (entrada, esperado) => expect(plano(segmentar(entrada))).toBe(esperado));

  test("no se pierde ni se inventa texto", () => {
    for (const t of ["x **y** z", "**a**", "a**b**c**d", "****", "**"]) {
      expect(segmentar(t).map((s) => s.texto).join("").replace(/\*\*/g, "")).toBe(t.replace(/\*\*/g, ""));
    }
  });
});

describe("formatearRespuesta", () => {
  test("párrafos separados por línea en blanco", () => {
    const b = formatearRespuesta("Primero.\n\nSegundo.");
    expect(b.map((x) => x.tipo)).toEqual(["parrafo", "parrafo"]);
  });

  test("listas con guion, asterisco, número y viñeta", () => {
    const b = formatearRespuesta("Pasos:\n- uno\n* dos\n1. tres\n2) cuatro\n• cinco");
    expect(b[0].tipo).toBe("parrafo");
    const lista = b[1];
    expect(lista.tipo === "lista" && lista.items.map(plano)).toEqual(["uno", "dos", "tres", "cuatro", "cinco"]);
  });

  test("los títulos de Markdown se muestran como texto común", () => {
    const b = formatearRespuesta("## Resumen\nTodo bien");
    expect(b[0].tipo === "parrafo" && b[0].lineas.map(plano)).toEqual(["Resumen", "Todo bien"]);
  });

  test("el HTML se queda como texto: no hay forma de colar etiquetas", () => {
    const b = formatearRespuesta('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(b[0].tipo === "parrafo" && plano(b[0].lineas[0])).toBe('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
  });

  test("vacío y solo espacios", () => {
    expect(formatearRespuesta("")).toEqual([]);
    expect(formatearRespuesta("  \n \n")).toEqual([]);
  });

  test("saltos de línea de Windows", () => {
    expect(formatearRespuesta("a\r\nb\r\n\r\nc")).toHaveLength(2);
  });

  test("un número con punto dentro de una frase NO es una lista", () => {
    const b = formatearRespuesta("Vendiste 3.500 pesos");
    expect(b[0].tipo).toBe("parrafo");
  });
});
