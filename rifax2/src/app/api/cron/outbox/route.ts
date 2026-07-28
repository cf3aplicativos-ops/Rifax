// Cron de Vercel: procesa el outbox de TODOS los tenants.
// Protegido con CRON_SECRET (Vercel envía Authorization: Bearer <CRON_SECRET>).
import { NextResponse, type NextRequest } from "next/server";
import { procesarOutbox } from "@/lib/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const res = await procesarOutbox(null, 100);
  return NextResponse.json({ ok: true, ...res });
}
