// Webhook de eventos de Wompi (confirmación real de pago — nunca se confía
// en el redirect del navegador para cambiar el estado de una venta). La
// referencia del pago es el código de la venta (VTA-AAAA-NNNNNN), globalmente
// único porque incluye el id de la propia venta; con eso se localiza el
// tenant y se verifica el checksum con SU secreto de eventos.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerCredencialesWompi } from "@/lib/integraciones";
import { verificarChecksumEventoWompi, type EventoWompi } from "@/lib/wompi";
import { registrarAbono, anularVenta } from "@/lib/ventas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let evento: EventoWompi;
  try {
    evento = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (evento.event !== "transaction.updated") {
    return NextResponse.json({ ok: true, ignorado: evento.event }, { status: 200 });
  }

  const transaccion = evento.data?.transaction as { reference?: string; status?: string } | undefined;
  const referencia = transaccion?.reference;
  const estadoPago = transaccion?.status;
  if (!referencia || !estadoPago) return NextResponse.json({ error: "Payload incompleto." }, { status: 400 });

  const venta = await prisma.ventas.findFirst({ where: { codigo: referencia }, select: { id: true, tenant_id: true, estado: true, total: true } });
  if (!venta) return NextResponse.json({ error: "Venta no encontrada para esa referencia." }, { status: 404 });

  const cred = await obtenerCredencialesWompi(venta.tenant_id);
  if (!cred) return NextResponse.json({ error: "La empresa no tiene Wompi configurado." }, { status: 400 });

  if (!verificarChecksumEventoWompi(evento, cred.eventsSecret)) {
    return NextResponse.json({ error: "Checksum inválido." }, { status: 401 });
  }

  // Idempotencia: Wompi puede reenviar el mismo evento; una venta ya resuelta
  // (pagada o anulada) no se vuelve a tocar.
  if (venta.estado === "pagada" || venta.estado === "anulada") {
    return NextResponse.json({ ok: true, yaResuelta: true }, { status: 200 });
  }

  if (estadoPago === "APPROVED") {
    const res = await registrarAbono(venta.tenant_id, venta.id, { monto: venta.total.toString(), origen: "pasarela" }, null);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(estadoPago)) {
    await anularVenta(venta.tenant_id, venta.id, `Pago rechazado en Wompi (${estadoPago}).`, null);
  }
  // Otros estados (PENDING, etc.): no hay nada que hacer todavía, se espera el próximo evento.

  return NextResponse.json({ ok: true }, { status: 200 });
}
