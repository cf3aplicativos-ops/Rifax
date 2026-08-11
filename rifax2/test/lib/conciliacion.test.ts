// Pruebas deterministas de parsearExtracto (src/lib/conciliacion.ts): el
// parseo de líneas de un extracto bancario pegado como texto, ANTES de que
// intervenga la IA (que sí requiere red y no se prueba aquí). No toca la
// base de datos ni la red.
import { describe, it, expect } from "vitest";
import { parsearExtracto } from "@/lib/conciliacion";

describe("parsearExtracto", () => {
  it("reconoce fecha ISO, descripción y monto separados por coma", () => {
    const r = parsearExtracto("2026-01-05,Juan Perez,50000");
    expect(r).toEqual([{ id: "ext-0", descripcion: "Juan Perez", monto: 50000, fecha: "2026-01-05" }]);
  });

  it("reconoce fecha dd/mm/aaaa y admite ; como separador de columnas", () => {
    const r = parsearExtracto("05/01/2026;Maria Lopez;50000");
    expect(r).toEqual([{ id: "ext-0", descripcion: "Maria Lopez", monto: 50000, fecha: "05/01/2026" }]);
  });

  it("trata el punto como separador de miles cuando agrupa exactamente 3 dígitos", () => {
    const r = parsearExtracto("Sin fecha,50.000");
    expect(r[0].monto).toBe(50000);
    expect(r[0].fecha).toBeNull();
  });

  it("conserva el punto como decimal cuando no agrupa de a 3 (p. ej. centavos)", () => {
    const r = parsearExtracto("Pago parcial,50.00");
    expect(r[0].monto).toBe(50);
  });

  it("toma el valor absoluto de montos negativos (retiros/débitos)", () => {
    const r = parsearExtracto("2026-01-05,Retiro,-50000");
    expect(r[0].monto).toBe(50000);
  });

  it("ignora líneas en blanco y numera por posición de línea original", () => {
    const r = parsearExtracto("2026-01-05,Ana,10000\n\n2026-01-06,Beto,20000");
    expect(r.map((e) => e.id)).toEqual(["ext-0", "ext-1"]);
  });

  it("omite una línea sin ningún token numérico reconocible (no revienta, solo la descarta)", () => {
    const r = parsearExtracto("2026-01-05,Sin monto aquí\n2026-01-06,Con Monto,15000");
    expect(r).toHaveLength(1);
    expect(r[0].descripcion).toBe("Con Monto");
  });

  it("junta varios campos de texto como descripción", () => {
    const r = parsearExtracto("2026-01-05,Juan,Perez Gomez,50000");
    expect(r[0].descripcion).toBe("Juan Perez Gomez");
  });

  it("sin separador reconocido de fecha/monto en una línea suelta, usa la línea completa como descripción", () => {
    const r = parsearExtracto("50000");
    expect(r[0]).toEqual({ id: "ext-0", descripcion: "50000", monto: 50000, fecha: null });
  });

  // Antes era una limitación conocida (reportada en la auditoría de calidad):
  // el monto se buscaba sobre columnas ya separadas por coma/punto y coma/tab,
  // así que un monto con coma decimal ("50.000,00", formato colombiano) quedaba
  // partido en dos columnas y la línea se descartaba en silencio. Corregido:
  // el monto se reconoce sobre la línea completa ANTES de partir en columnas,
  // con el mismo criterio sin importar qué separador de columnas se use.
  it("reconoce un monto con coma decimal ('50.000,00', formato colombiano) sin importar el separador de columnas", () => {
    const r1 = parsearExtracto("2026-01-05,Ana Torres,50.000,00");
    expect(r1).toEqual([{ id: "ext-0", descripcion: "Ana Torres", monto: 50000, fecha: "2026-01-05" }]);

    const r2 = parsearExtracto("2026-01-05;Ana Torres;50.000,00");
    expect(r2).toEqual([{ id: "ext-0", descripcion: "Ana Torres", monto: 50000, fecha: "2026-01-05" }]);
  });

  it("reconoce un monto con separador de miles por coma y decimal por punto ('50,000.00')", () => {
    const r = parsearExtracto("2026-01-05,Carlos Ruiz,50,000.00");
    expect(r).toEqual([{ id: "ext-0", descripcion: "Carlos Ruiz", monto: 50000, fecha: "2026-01-05" }]);
  });
});
