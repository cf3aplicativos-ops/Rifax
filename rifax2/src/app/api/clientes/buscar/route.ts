// Autocompletar cliente por documento (punto 15), en TODAS las sedes del
// tenant — se usa desde "Nueva venta" mientras se escribe el documento.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buscarClientePorDocumento } from "@/lib/clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("venta.crear")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const documento = searchParams.get("documento");
  if (!documento || documento.trim().length < 3) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });

  const cliente = await buscarClientePorDocumento(user.tenant.id, documento);
  return NextResponse.json({ ok: true, cliente }, { headers: { "Cache-Control": "no-store" } });
}
