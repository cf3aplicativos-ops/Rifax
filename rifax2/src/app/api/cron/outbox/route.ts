// Cron de Vercel: procesa el outbox de TODOS los tenants y limpia carritos
// abandonados de la compra en línea (punto 4). Ambas tareas de
// mantenimiento van en el mismo cron (no dos crons separados): el plan
// Hobby de Vercel limita cuántos crons hay y con qué frecuencia pueden
// correr, así que se aprovecha el único disparador diario que ya existía.
// Protegido con CRON_SECRET (Vercel envía Authorization: Bearer <CRON_SECRET>).
import { NextResponse, type NextRequest } from "next/server";
import { procesarOutbox } from "@/lib/outbox";
import { limpiarComprasWebAbandonadas } from "@/lib/ventas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [outbox, carritos] = await Promise.all([
    procesarOutbox(null, 100),
    limpiarComprasWebAbandonadas(),
  ]);
  return NextResponse.json({ ok: true, ...outbox, carritosAnulados: carritos.anuladas });
}
