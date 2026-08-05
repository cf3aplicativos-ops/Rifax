// Crea una solicitud de traspaso para una boleta que no es del solicitante.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { crearSolicitudTraspaso, contextoDeUsuarioParaRifa } from "@/lib/traspasos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("boleta.traspasar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  let body: { rifaId?: string; numero?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const numero = Number(body.numero);
  if (!body.rifaId || !Number.isInteger(numero) || numero < 0) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }
  let rifaId: bigint;
  try { rifaId = BigInt(body.rifaId); } catch { return NextResponse.json({ error: "Rifa inválida." }, { status: 400 }); }

  const contexto = await contextoDeUsuarioParaRifa(user.tenant.id, user, rifaId);
  if (!contexto) return NextResponse.json({ error: "No se pudo determinar tu punto de venta o vendedor." }, { status: 400 });

  const res = await crearSolicitudTraspaso(user.tenant.id, rifaId, numero, contexto, user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, solicitudId: res.data?.solicitudId }, { headers: { "Cache-Control": "no-store" } });
}
