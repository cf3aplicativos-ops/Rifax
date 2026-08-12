// Compra en línea desde la landing pública de una empresa (punto 4): crea la
// venta (reservando las boletas con las mismas 3 barreras anti-doble-venta
// de siempre) y arma el checkout hospedado de Wompi. La confirmación real del
// pago SIEMPRE llega por el webhook (ver /api/webhooks/wompi) — este flujo
// nunca marca una venta como pagada por sí mismo.
import "server-only";
import { prisma } from "@/lib/prisma";
import { crearVenta } from "@/lib/ventas";
import { obtenerCredencialesWompi } from "@/lib/integraciones";
import { construirUrlCheckoutWompi } from "@/lib/wompi";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Las boletas elegidas deben pertenecer todas al MISMO dueño (un solo
// vendedor, o ninguno = punto de venta): una venta solo admite un
// vendedor_id, así que no hay forma de repartir la comisión por boleta
// dentro de una misma compra. Es la misma regla que ya aplica una venta
// hecha por un cajero en el panel.
async function vendedorConsistente(tenantId: bigint, rifaId: bigint, numeros: number[]): Promise<Resultado<{ vendedorId: bigint | null }>> {
  const filas = await prisma.$queryRawUnsafe<{ vendedor_id: bigint | null }[]>(
    `SELECT DISTINCT t.vendedor_id
       FROM saas.boletas b
       LEFT JOIN saas.talonarios t ON t.id = b.talonario_id
      WHERE b.rifa_id = $1::bigint AND b.tenant_id = $2::bigint AND b.numero = ANY($3::int[])`,
    rifaId, tenantId, numeros,
  );
  // Un número sin vendedor (punto de venta) es compatible con cualquier
  // vendedor en la misma compra (toda la venta le queda atribuida, igual que
  // ya pasa en cualquier venta interna); lo único que no se puede mezclar es
  // DOS vendedores distintos en una misma venta.
  const dueñosDistintos = new Set(filas.map((f) => f.vendedor_id).filter((v): v is bigint => v !== null).map(String));
  if (dueñosDistintos.size > 1) {
    return { ok: false, error: "Elige números de un mismo vendedor por compra (los que elegiste pertenecen a vendedores distintos). Hazlo en compras separadas." };
  }
  const vendedorId = filas.find((f) => f.vendedor_id !== null)?.vendedor_id ?? null;
  return { ok: true, data: { vendedorId } };
}

export async function iniciarCompraPublica(input: {
  slug: string;
  rifaId: bigint;
  numeros: number[];
  cliente: { nombre: string; telefono: string; correo?: string; documento?: string; consentimiento_datos?: boolean };
  origen: string; // origin de la request (para construir la redirect-url), ej. "https://rifax2.vercel.app"
}): Promise<Resultado<{ checkoutUrl: string }>> {
  if (input.numeros.length === 0) return { ok: false, error: "Elige al menos un número." };

  const tenant = await prisma.tenants.findFirst({ where: { slug: input.slug, estado: "activo" }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Empresa no encontrada." };

  const cred = await obtenerCredencialesWompi(tenant.id);
  if (!cred) return { ok: false, error: "Esta empresa aún no tiene configurado el pago en línea. Intenta más tarde o contáctala directamente." };

  const vc = await vendedorConsistente(tenant.id, input.rifaId, input.numeros);
  if (!vc.ok) return vc;

  const venta = await crearVenta(
    {
      rifa_id: String(input.rifaId),
      numeros: input.numeros,
      cliente: input.cliente,
      ...(vc.data?.vendedorId ? { vendedor_id: String(vc.data.vendedorId) } : {}),
    },
    tenant.id,
    null,
  );
  if (!venta.ok) return venta;

  const montoCentavos = Math.round(Number(venta.data.total) * 100);
  const checkoutUrl = construirUrlCheckoutWompi({
    publicKey: cred.publicKey,
    sandbox: cred.sandbox,
    referencia: venta.data.codigo,
    montoCentavos,
    redirectUrl: `${input.origen}/e/${input.slug}/gracias?venta=${venta.data.ventaId}`,
    secretoIntegridad: cred.eventsSecret,
    clienteEmail: input.cliente.correo,
    clienteNombre: input.cliente.nombre,
    clienteTelefono: input.cliente.telefono,
  });

  return { ok: true, data: { checkoutUrl } };
}
