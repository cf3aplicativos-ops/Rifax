// Exportación de reportes en CSV. Autenticado por la sesión del tenant
// (permiso reporte.ver). Descarga como archivo adjunto.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { listarVentas } from "@/lib/ventas";
import { listarCartera } from "@/lib/cartera";
import { avancePorRifa, verificarAuditoria, ventasPorVendedor } from "@/lib/reportes";
import { estadoComisiones, comisionesDetalladas } from "@/lib/comisiones";
import { opcionesDe } from "@/lib/catalogos";

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
  const nombre = recurso;

  if (recurso === "ventas") {
    const [v, canales] = await Promise.all([listarVentas(t, sede), opcionesDe(t, "canal_venta")]);
    const etiquetaCanal = new Map(canales.map((c) => [c.valor, c.etiqueta]));
    csv = toCsv(
      ["Codigo", "Rifa", "Boletas", "Cliente", "Telefono", "Vendedor", "Sede", "Medio", "Cantidad", "Total", "Saldo", "Estado", "Fecha", "Observaciones"],
      v.map((x) => [x.codigo, x.rifas.codigo, x.boletas.join(" "), x.clientes.nombre, x.clientes.telefono, x.vendedores?.nombre ?? "Punto de venta", x.sedes.nombre, etiquetaCanal.get(x.canal) ?? x.canal, x.cantidad, x.total.toString(), x.saldo.toString(), x.estado, x.creado_en.toISOString().slice(0, 10), x.observaciones ?? ""]),
    );
  } else if (recurso === "vendedores") {
    const v = await ventasPorVendedor(t, sede);
    csv = toCsv(
      ["Vendedor", "Sede", "Ventas", "Facturado", "Recaudado"],
      v.map((x) => [x.vendedorNombre, x.sedeNombre, x.ventas, x.facturado, x.recaudado]),
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
  } else if (recurso === "comisiones") {
    if (!user.permisos.includes("cartera.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const c = await estadoComisiones(t);
    csv = toCsv(
      ["Vendedor", "Pct", "Recaudado", "Comision", "Liquidado", "Pendiente"],
      c.map((x) => [x.nombre, x.pct, x.recaudado, x.comisionGanada, x.liquidado, x.pendiente]),
    );
  } else if (recurso === "comisiones-detalle") {
    if (!user.permisos.includes("cartera.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const d = await comisionesDetalladas(t, sede);
    csv = toCsv(
      ["Venta", "Fecha", "Vendedor", "Rifa", "Boletas", "Cliente", "Recaudado", "Pct", "Comision"],
      d.map((x) => [x.codigo, x.fecha.toISOString().slice(0, 10), x.vendedorNombre, x.rifaCodigo, x.boletas.join(" "), x.cliente, x.recaudadoVenta, x.pct, x.comisionVenta]),
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
      // Datos sensibles (clientes, saldos): no cachear en proxies/CDN intermedios.
      "Cache-Control": "no-store, private",
    },
  });
}
