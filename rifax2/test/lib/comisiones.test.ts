// Pruebas deterministas de la aritmética de comisiones (src/lib/comisiones.ts).
// calcularComision/calcularPendiente son funciones puras extraídas del cálculo
// que antes vivía inline en estadoComisiones(); no se toca la base de datos.
import { describe, it, expect } from "vitest";
import { calcularComision, calcularPendiente } from "@/lib/comisiones";

describe("calcularComision", () => {
  it("calcula el porcentaje simple", () => {
    expect(calcularComision(100000, 10)).toBe(10000);
  });

  it("redondea a 2 decimales", () => {
    // 33333 * 15% = 4999.95 exacto
    expect(calcularComision(33333, 15)).toBe(4999.95);
  });

  it("redondea correctamente casos con más de 2 decimales", () => {
    // 100 * 33.333% = 33.333 -> redondeado a 33.33
    expect(calcularComision(100, 33.333)).toBe(33.33);
  });

  it("devuelve 0 cuando el porcentaje es 0", () => {
    expect(calcularComision(500000, 0)).toBe(0);
  });

  it("devuelve 0 cuando lo recaudado es 0", () => {
    expect(calcularComision(0, 25)).toBe(0);
  });

  it("soporta 100% de comisión (recaudado completo)", () => {
    expect(calcularComision(12345, 100)).toBe(12345);
  });
});

describe("calcularPendiente", () => {
  it("resta lo liquidado de la comisión ganada", () => {
    expect(calcularPendiente(10000, 4000)).toBe(6000);
  });

  it("puede dar negativo si se liquidó de más (no se acota aquí; el llamador decide)", () => {
    expect(calcularPendiente(1000, 1500)).toBe(-500);
  });

  it("redondea a 2 decimales", () => {
    expect(calcularPendiente(100.111, 0.001)).toBe(100.11);
  });

  it("da 0 cuando todo lo ganado ya fue liquidado", () => {
    expect(calcularPendiente(5000, 5000)).toBe(0);
  });
});
