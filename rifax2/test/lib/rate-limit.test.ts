// Pruebas deterministas del limitador de tasa en memoria (src/lib/rate-limit.ts).
// Usa timers falsos para controlar el paso del tiempo sin esperas reales; no
// toca la base de datos ni la red.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { permitir, reiniciar } from "@/lib/rate-limit";

describe("permitir", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite el primer intento para una clave nueva", () => {
    expect(permitir(`clave-${Math.random()}`, 3, 60_000)).toBe(true);
  });

  it("permite hasta el límite y bloquea el intento que lo supera", () => {
    const clave = `clave-${Math.random()}`;
    expect(permitir(clave, 3, 60_000)).toBe(true); // 1
    expect(permitir(clave, 3, 60_000)).toBe(true); // 2
    expect(permitir(clave, 3, 60_000)).toBe(true); // 3
    expect(permitir(clave, 3, 60_000)).toBe(false); // 4: supera el límite
  });

  it("sigue bloqueando en intentos sucesivos una vez superado el límite", () => {
    const clave = `clave-${Math.random()}`;
    for (let i = 0; i < 5; i++) permitir(clave, 2, 60_000);
    expect(permitir(clave, 2, 60_000)).toBe(false);
  });

  it("mantiene contadores independientes por clave", () => {
    const a = `clave-a-${Math.random()}`;
    const b = `clave-b-${Math.random()}`;
    expect(permitir(a, 1, 60_000)).toBe(true);
    expect(permitir(a, 1, 60_000)).toBe(false); // 'a' ya agotó su cupo
    expect(permitir(b, 1, 60_000)).toBe(true); // 'b' no se ve afectada por 'a'
  });

  it("reinicia el contador al expirar la ventana de tiempo", () => {
    const clave = `clave-${Math.random()}`;
    expect(permitir(clave, 1, 60_000)).toBe(true);
    expect(permitir(clave, 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_001); // la ventana expira
    expect(permitir(clave, 1, 60_000)).toBe(true); // nueva ventana, cupo fresco
  });

  it("reiniciar() descarta el contador de una clave (p. ej. tras login correcto)", () => {
    const clave = `clave-${Math.random()}`;
    expect(permitir(clave, 1, 60_000)).toBe(true);
    expect(permitir(clave, 1, 60_000)).toBe(false);
    reiniciar(clave);
    expect(permitir(clave, 1, 60_000)).toBe(true); // vuelve a tener cupo completo
  });

  it("reiniciar() en una clave inexistente no lanza", () => {
    expect(() => reiniciar(`inexistente-${Math.random()}`)).not.toThrow();
  });
});
