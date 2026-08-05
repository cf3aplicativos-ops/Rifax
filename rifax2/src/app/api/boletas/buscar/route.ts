// Búsqueda de una boleta por número (autenticada). Informa su estado real:
// tuya / vendida / disponible en el punto de venta / asignada a un vendedor.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buscarBoleta, contextoDeUsuarioParaRifa } from "@/lib/traspasos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("venta.crear")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rifaId = searchParams.get("rifaId");
  const numeroStr = searchParams.get("numero");
  const numero = Number(numeroStr);
  if (!rifaId || !Number.isInteger(numero) || numero < 0) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  let rifaIdBig: bigint;
  try { rifaIdBig = BigInt(rifaId); } catch { return NextResponse.json({ error: "Rifa inválida." }, { status: 400 }); }

  const contexto = await contextoDeUsuarioParaRifa(user.tenant.id, user, rifaIdBig);
  const estado = await buscarBoleta(user.tenant.id, rifaIdBig, numero, contexto);
  return NextResponse.json({ ok: true, estado }, { headers: { "Cache-Control": "no-store" } });
}
