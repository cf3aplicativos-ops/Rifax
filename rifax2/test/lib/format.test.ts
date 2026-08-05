// Pruebas deterministas para src/lib/format.ts. Se evitan comparaciones de
// cadena exactas contra Intl (varían con la versión de ICU del runtime); se
// valida el contenido numérico/estructural en su lugar.
import { describe, it, expect } from "vitest";
import { money, fecha, estadoVentaClase } from "@/lib/format";

describe("money", () => {
  it("formatea un number como pesos colombianos sin decimales", () => {
    expect(money(1000)).toMatch(/1\.000/);
    expect(money(1000)).toMatch(/\$/);
  });

  it("acepta un string numérico (p.ej. de Prisma Decimal)", () => {
    expect(money("2500")).toMatch(/2\.500/);
  });

  it("acepta un objeto con toString() (Decimal-like)", () => {
    const decimalLike = { toString: () => "999" };
    expect(money(decimalLike)).toMatch(/999/);
  });

  it("redondea a 0 decimales", () => {
    // maximumFractionDigits: 0 -> nunca debe aparecer una coma/punto decimal final.
    expect(money(1000.6)).not.toMatch(/,6|\.6\d/);
  });

  it("maneja cero", () => {
    expect(money(0)).toMatch(/0/);
  });
});

describe("fecha", () => {
  it("formatea una fecha fija sin lanzar y produce texto no vacío", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    const out = fecha(d);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("estadoVentaClase", () => {
  it("tiene una clase para cada estado de venta conocido", () => {
    for (const estado of ["pendiente_pago", "parcial", "pagada", "anulada", "vencida"]) {
      expect(estadoVentaClase[estado]).toBeDefined();
      expect(typeof estadoVentaClase[estado]).toBe("string");
    }
  });
});
