// Pruebas puras (sin red) de la integración Wompi: firma del checkout y
// verificación del checksum de eventos. No hay un caso de prueba oficial de
// Wompi con el que contrastar el hash exacto (solo su documentación textual),
// así que estas pruebas verifican que la implementación es determinista,
// sensible a cualquier cambio de los datos firmados, y que firmar+verificar
// es simétrico y consistente consigo mismo — no que coincide byte a byte con
// el servidor real de Wompi (eso solo se puede confirmar con credenciales de
// sandbox reales, ver docs/bitacora.md).
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { firmaIntegridadCheckout, construirUrlCheckoutWompi, verificarChecksumEventoWompi, type EventoWompi } from "@/lib/wompi";

describe("firmaIntegridadCheckout", () => {
  it("es determinista: mismos datos producen la misma firma", () => {
    const a = firmaIntegridadCheckout("VTA-1", 5000000, "COP", "secreto");
    const b = firmaIntegridadCheckout("VTA-1", 5000000, "COP", "secreto");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cambia si cambia cualquiera de los campos firmados", () => {
    const base = firmaIntegridadCheckout("VTA-1", 5000000, "COP", "secreto");
    expect(firmaIntegridadCheckout("VTA-2", 5000000, "COP", "secreto")).not.toBe(base);
    expect(firmaIntegridadCheckout("VTA-1", 5000001, "COP", "secreto")).not.toBe(base);
    expect(firmaIntegridadCheckout("VTA-1", 5000000, "COP", "otro-secreto")).not.toBe(base);
    expect(firmaIntegridadCheckout("VTA-1", 5000000, "COP", "secreto", "2026-12-31T00:00:00.000Z")).not.toBe(base);
  });
});

describe("construirUrlCheckoutWompi", () => {
  it("arma la URL del Web Checkout con los parámetros exigidos por Wompi", () => {
    const url = construirUrlCheckoutWompi({
      publicKey: "pub_test_123", sandbox: true, referencia: "VTA-9", montoCentavos: 1000000,
      redirectUrl: "https://rifax2.vercel.app/e/demo/gracias", secretoIntegridad: "sec",
      clienteEmail: "cliente@correo.com",
    });
    expect(url.startsWith("https://checkout.wompi.co/p/?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("public-key")).toBe("pub_test_123");
    expect(q.get("currency")).toBe("COP");
    expect(q.get("amount-in-cents")).toBe("1000000");
    expect(q.get("reference")).toBe("VTA-9");
    expect(q.get("redirect-url")).toBe("https://rifax2.vercel.app/e/demo/gracias");
    expect(q.get("customer-data:email")).toBe("cliente@correo.com");
    expect(q.get("signature:integrity")).toBe(firmaIntegridadCheckout("VTA-9", 1000000, "COP", "sec"));
  });
});

describe("verificarChecksumEventoWompi", () => {
  function eventoFirmado(secreto: string, overrides: Partial<{ id: string; status: string; amount: number; timestamp: number }> = {}): EventoWompi {
    const id = overrides.id ?? "123-456";
    const status = overrides.status ?? "APPROVED";
    const amount = overrides.amount ?? 5000000;
    const timestamp = overrides.timestamp ?? 1700000000;
    const base = `${id}${status}${amount}${timestamp}${secreto}`;
    const checksum = createHash("sha256").update(base).digest("hex");
    return {
      event: "transaction.updated",
      data: { transaction: { id, status, amount_in_cents: amount } },
      signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum },
      timestamp,
    };
  }

  it("acepta un evento cuyo checksum coincide con el secreto correcto", () => {
    const evento = eventoFirmado("secreto-eventos");
    expect(verificarChecksumEventoWompi(evento, "secreto-eventos")).toBe(true);
  });

  it("rechaza si el secreto no coincide", () => {
    const evento = eventoFirmado("secreto-eventos");
    expect(verificarChecksumEventoWompi(evento, "otro-secreto")).toBe(false);
  });

  it("rechaza si el payload fue alterado después de firmarse (status distinto)", () => {
    const evento = eventoFirmado("secreto-eventos");
    evento.data = { transaction: { ...(evento.data.transaction as object), status: "DECLINED" } };
    expect(verificarChecksumEventoWompi(evento, "secreto-eventos")).toBe(false);
  });

  it("rechaza si falta la propiedad de firma o el checksum", () => {
    const evento = eventoFirmado("secreto-eventos");
    expect(verificarChecksumEventoWompi({ ...evento, signature: { properties: [], checksum: "" } }, "secreto-eventos")).toBe(false);
  });
});
