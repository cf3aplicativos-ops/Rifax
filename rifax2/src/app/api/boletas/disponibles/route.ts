// Lista de números disponibles de una rifa para el desplegable de
// "Abonados" al asignar talonario (autenticada, mismo criterio de sede que
// valida `asignarTalonario`).
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { boletasDisponiblesParaTalonario } from "@/lib/vendedores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("talonario.asignar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rifaIdStr = searchParams.get("rifaId");
  const vendedorIdStr = searchParams.get("vendedorId");
  if (!rifaIdStr || !vendedorIdStr) return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });

  let rifaId: bigint;
  let vendedorId: bigint;
  try {
    rifaId = BigInt(rifaIdStr);
    vendedorId = BigInt(vendedorIdStr);
  } catch {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  const res = await boletasDisponiblesParaTalonario(user.tenant.id, rifaId, vendedorId, user.sede?.id ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, numeros: res.data?.numeros ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
