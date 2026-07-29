// Exportación de reportes en CSV. Autenticado por la sesión del tenant
// (permiso reporte.ver). Descarga como archivo adjunto.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { listarVentas } from "@/lib/ventas";
import { listarCartera } from "@/lib/cartera";
import { avancePorRifa, verificarAuditoria } from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ recurso: string }> }) {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("reporte.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { recurso } = await params;
  const t = user.tenant.id;
  const sede = user.sede?.id ?? null;
  let csv = "";
  let nombre = recurso;

  if (recurso === "ventas") {
    const v = await listarVentas(t, sede);
    csv = toCsv(
      ["Codigo", "Rifa", "Cliente", "Telefono", "Cantidad", "Total", "Saldo", "Estado", "Fecha"],
      v.map((x) => [x.codigo, x.rifas.codigo, x.clientes.nombre, x.clientes.telefono, x.cantidad, x.total.toString(), x.saldo.toString(), x.estado, x.creado_en.toISOString().slice(0, 10)]),
    );
  } else if (recurso === "cartera") {
    const c = await listarCartera(t, sede);
    csv = toCsv(
      ["Venta", "Cliente", "Telefono", "Saldo", "Dias", "Tramo"],
      c.map((x) => [x.codigo, x.cliente, x.telefono, x.saldo, x.dias_antiguedad, x.tramo]),
    );
  } else if (recurso === "avance") {
    const a = await avancePorRifa(t, sede);
    csv = toCsv(
      ["Codigo", "Nombre", "Estado", "Total boletas", "Pagadas", "Reservadas", "Disponibles", "Recaudo"],
      a.map((x) => [x.codigo, x.nombre, x.estado, x.totalBoletas, x.pagadas, x.reservadas, x.disponibles, x.recaudo]),
    );
  } else if (recurso === "auditoria") {
    if (!user.permisos.includes("reporte.auditoria")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const au = await verificarAuditoria(t);
    csv = toCsv(
      ["ID", "Accion", "Entidad", "Actor", "Fecha", "Hash"],
      au.recientes.map((e) => [e.id, e.accion, e.entidad, e.actorTipo, e.fecha.toISOString(), e.hash ?? ""]),
    );
  } else {
    return NextResponse.json({ error: "Reporte desconocido" }, { status: 404 });
  }

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rifax-${nombre}-${fecha}.csv"`,
    },
  });
}
