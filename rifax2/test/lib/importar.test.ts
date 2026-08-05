// Pruebas deterministas del parser de CSV y del expansor de rangos de números
// usados por la carga masiva (src/lib/importar.ts). No tocan la base de datos:
// solo se ejercitan las funciones puras `parseCsv` y `expandirNumeros`.
// (importar.ts sigue importando `@/lib/prisma` a nivel de módulo, por lo que
// requiere DATABASE_URL definido -- igual que el resto de la suite, ver
// test/setup.ts -- pero estas pruebas no ejecutan ninguna consulta.)
import { describe, it, expect } from "vitest";
import { parseCsv, expandirNumeros } from "@/lib/importar";

describe("parseCsv", () => {
  it("parsea filas simples separadas por coma", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("soporta campos entre comillas con comas internas", () => {
    expect(parseCsv('nombre,nota\n"Pérez, Juan","hola"')).toEqual([
      ["nombre", "nota"],
      ["Pérez, Juan", "hola"],
    ]);
  });

  it("soporta comillas escapadas dentro de un campo entrecomillado", () => {
    expect(parseCsv('a\n"dijo ""hola"""')).toEqual([["a"], ['dijo "hola"']]);
  });

  it("normaliza finales de línea \\r\\n a \\n", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("descarta filas completamente vacías (solo separadores/espacios)", () => {
    expect(parseCsv("a,b\n1,2\n\n , \n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("incluye la última fila aunque no termine en salto de línea", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("devuelve un array vacío para texto vacío", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("expandirNumeros", () => {
  it("expande un rango simple 'a-b' inclusivo", () => {
    expect(expandirNumeros("1-5")).toEqual([1, 2, 3, 4, 5]);
  });

  it("expande un rango invertido 'b-a' (min-max se normaliza)", () => {
    expect(expandirNumeros("5-1")).toEqual([1, 2, 3, 4, 5]);
  });

  it("acepta números sueltos separados por coma, espacio o punto y coma", () => {
    expect(expandirNumeros("1, 2;3  4")).toEqual([1, 2, 3, 4]);
  });

  it("deduplica números repetidos (incluso entre rangos y sueltos)", () => {
    expect(expandirNumeros("1-3,2,3,4")).toEqual([1, 2, 3, 4]);
  });

  it("ignora tokens no numéricos", () => {
    expect(expandirNumeros("1,abc,2,--,3")).toEqual([1, 2, 3]);
  });

  it("devuelve un array vacío para texto vacío o solo separadores", () => {
    expect(expandirNumeros("")).toEqual([]);
    expect(expandirNumeros("   ,;  ")).toEqual([]);
  });

  it("acepta un único rango de un solo número (a-a)", () => {
    expect(expandirNumeros("7-7")).toEqual([7]);
  });
});
