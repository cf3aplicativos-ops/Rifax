// Pruebas deterministas para src/lib/csv.ts (generación de CSV para exportar).
// No usan red ni base de datos: toCsv es una función pura.
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("antepone el BOM UTF-8 (compatibilidad con Excel)", () => {
    const out = toCsv(["a"], [["1"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
  });

  it("separa columnas con ; y filas con \\r\\n", () => {
    const out = toCsv(["a", "b"], [
      ["1", "2"],
      ["3", "4"],
    ]);
    const sinBom = out.slice(1);
    expect(sinBom).toBe("a;b\r\n1;2\r\n3;4");
  });

  it("entrecomilla valores que contienen ;, comillas o saltos de línea", () => {
    const out = toCsv(["nombre"], [['Pérez; "Pepe"'], ["línea1\nlínea2"]]).slice(1);
    const filas = out.split("\r\n");
    expect(filas[1]).toBe('"Pérez; ""Pepe"""');
    expect(filas[2]).toBe('"línea1\nlínea2"');
  });

  it("no entrecomilla valores simples (sin ;, comillas ni saltos)", () => {
    const out = toCsv(["a"], [["valor simple"]]).slice(1);
    expect(out.split("\r\n")[1]).toBe("valor simple");
  });

  it("convierte null/undefined a cadena vacía", () => {
    const out = toCsv(["a", "b"], [[null, 5]]).slice(1);
    expect(out.split("\r\n")[1]).toBe(";5");
  });

  it("funciona sin filas (solo encabezado)", () => {
    const out = toCsv(["a", "b"], []).slice(1);
    expect(out).toBe("a;b");
  });
});
