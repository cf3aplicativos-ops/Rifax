// Pruebas deterministas de src/lib/color.ts (color de marca configurable por
// tenant). Funciones puras, sin red ni base de datos.
import { describe, it, expect } from "vitest";
import { darken, luminancia, brandCss } from "@/lib/color";

describe("darken", () => {
  it("oscurece un color en el porcentaje indicado", () => {
    expect(darken("#ffffff", 0.5)).toBe("#808080");
  });

  it("acepta el hex sin el símbolo #", () => {
    expect(darken("ffffff", 0.5)).toBe("#808080");
  });

  it("no deja ningún canal por debajo de 0", () => {
    expect(darken("#000000", 0.9)).toBe("#000000");
  });

  it("devuelve el valor de entrada sin cambios si no es un hex de 6 dígitos válido", () => {
    expect(darken("no-es-un-color", 0.5)).toBe("no-es-un-color");
    expect(darken("#fff", 0.5)).toBe("#fff"); // hex corto (3 dígitos) no soportado
  });
});

describe("luminancia", () => {
  it("el blanco tiene luminancia 1 y el negro 0", () => {
    expect(luminancia("#ffffff")).toBeCloseTo(1);
    expect(luminancia("#000000")).toBe(0);
  });

  it("devuelve 0 para una entrada inválida (no revienta)", () => {
    expect(luminancia("no-es-un-color")).toBe(0);
  });

  it("el amarillo (marca RIFAX) es más luminoso que el marino", () => {
    expect(luminancia("#f5c518")).toBeGreaterThan(luminancia("#1e293b"));
  });
});

describe("brandCss", () => {
  it("usa el color de marca provisto cuando es un hex válido", () => {
    const css = brandCss("#ff0000");
    expect(css).toContain("--rifax-accent:#ff0000;");
    expect(css).toContain("--color-indigo-500:#ff0000;");
  });

  it("cae al amarillo por defecto si el color de entrada no es un hex #rrggbb válido", () => {
    const css = brandCss("javascript:alert(1)");
    expect(css).toContain("--rifax-accent:#f5c518;");
    expect(css).not.toContain("javascript:alert(1)");
  });

  it("elige texto oscuro sobre un color de marca claro, y texto blanco sobre uno oscuro", () => {
    const claro = brandCss("#ffff00"); // amarillo puro: claro
    const oscuro = brandCss("#000080"); // azul marino: oscuro
    expect(claro).toContain(".bg-indigo-600{color:#1e293b !important}");
    expect(oscuro).toContain(".bg-indigo-600{color:#ffffff !important}");
  });
});
