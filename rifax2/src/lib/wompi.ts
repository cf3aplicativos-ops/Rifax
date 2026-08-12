// Integración con la pasarela Wompi (Web Checkout hospedado + eventos/webhook).
// Funciones puras y deterministas donde es posible (firma/checksum), para
// poder probarlas sin red ni credenciales reales. Formato verificado contra
// la documentación oficial de Wompi (Web Checkout + Eventos), 2026-08-11.
import { createHash } from "node:crypto";

const URL_CHECKOUT = "https://checkout.wompi.co/p/";

// SHA256("<referencia><monto-en-centavos><moneda>[<expiracion-iso>]<secreto-de-integridad>").
// El orden y la ausencia/presencia de expiración son exactamente los que
// exige Wompi para que el widget acepte la transacción.
export function firmaIntegridadCheckout(
  referencia: string, montoCentavos: number, moneda: string, secretoIntegridad: string, expiracionIso?: string,
): string {
  const base = `${referencia}${montoCentavos}${moneda}${expiracionIso ?? ""}${secretoIntegridad}`;
  return createHash("sha256").update(base).digest("hex");
}

export interface CheckoutWompi {
  publicKey: string;
  sandbox: boolean;
  referencia: string;
  montoCentavos: number;
  redirectUrl: string;
  secretoIntegridad: string;
  clienteEmail?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
}

// Construye la URL del Web Checkout hospedado de Wompi (GET, formulario
// estándar de Wompi) — moneda fija COP (única soportada hoy por Wompi Colombia).
export function construirUrlCheckoutWompi(c: CheckoutWompi): string {
  const firma = firmaIntegridadCheckout(c.referencia, c.montoCentavos, "COP", c.secretoIntegridad);
  const params = new URLSearchParams({
    "public-key": c.publicKey,
    "currency": "COP",
    "amount-in-cents": String(c.montoCentavos),
    "reference": c.referencia,
    "signature:integrity": firma,
    "redirect-url": c.redirectUrl,
  });
  if (c.clienteEmail) params.set("customer-data:email", c.clienteEmail);
  if (c.clienteNombre) params.set("customer-data:full-name", c.clienteNombre);
  if (c.clienteTelefono) params.set("customer-data:phone-number", c.clienteTelefono);
  return `${URL_CHECKOUT}?${params.toString()}`;
}

export interface EventoWompi {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

// Navega "transaction.id" -> data.transaction.id (las rutas de
// signature.properties son siempre dentro de `data`, según la documentación).
function valorPorRuta(obj: Record<string, unknown>, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((acc, parte) => {
    if (acc && typeof acc === "object" && parte in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[parte];
    }
    return undefined;
  }, obj);
}

// SHA256(valores de signature.properties, en ese orden, + timestamp + secreto de eventos).
// Se recalcula del lado del servidor y se compara con signature.checksum — es
// la única forma confiable de saber que el evento vino realmente de Wompi
// (nunca se confía en el redirect-url del navegador para cambiar estado).
export function verificarChecksumEventoWompi(evento: EventoWompi, secretoEventos: string): boolean {
  if (!evento?.signature?.properties?.length || !evento.signature.checksum) return false;
  const valores = evento.signature.properties.map((ruta) => String(valorPorRuta(evento.data, ruta) ?? ""));
  const base = valores.join("") + String(evento.timestamp) + secretoEventos;
  const calculado = createHash("sha256").update(base).digest("hex");
  return calculado.toLowerCase() === evento.signature.checksum.toLowerCase();
}
