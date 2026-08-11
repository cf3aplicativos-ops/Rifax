// Pruebas deterministas del cálculo de precio del plan básico según la
// periodicidad de pago (src/lib/plataforma.ts). Función pura: no toca la BD.
import { describe, it, expect } from "vitest";
import { precioBasicoPorPeriodicidad, type ConfigPlataforma } from "@/lib/plataforma";

const config: ConfigPlataforma = {
  precioBasicoMensual: 180000,
  precioBasicoSemestral: 140000,
  precioBasicoAnual: 120000,
  precioCorporativoTexto: "A medida",
  sedesBasico: 1,
  sedesCorporativo: 2,
};

describe("precioBasicoPorPeriodicidad", () => {
  it("devuelve el precio mensual para periodicidad 'mensual'", () => {
    expect(precioBasicoPorPeriodicidad(config, "mensual")).toBe(180000);
  });

  it("devuelve el precio semestral para periodicidad 'semestral'", () => {
    expect(precioBasicoPorPeriodicidad(config, "semestral")).toBe(140000);
  });

  it("devuelve el precio anual para periodicidad 'anual'", () => {
    expect(precioBasicoPorPeriodicidad(config, "anual")).toBe(120000);
  });

  it("usa el precio mensual como valor por defecto ante una periodicidad desconocida", () => {
    expect(precioBasicoPorPeriodicidad(config, "quincenal")).toBe(180000);
    expect(precioBasicoPorPeriodicidad(config, "")).toBe(180000);
  });
});
