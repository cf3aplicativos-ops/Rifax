// Endpoint para procesar el outbox de forma programada (Vercel Cron).
// Se protege con CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>".
// Si la variable no está configurada, el endpoint queda deshabilitado (503) para
// no exponer un disparador sin autenticar.
import { NextResponse, type NextRequest } from "next/server";
import { procesarOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Prisma no corre en Edge.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = await procesarOutbox(100);
  return NextResponse.json({ ok: true, ...res });
}
