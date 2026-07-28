// Reportes de negocio (multi-tenant) + verificación de integridad de auditoría.
import "server-only";
import { prisma } from "@/lib/prisma";

export interface ResumenVentas {
  recaudado: string;
  facturado: string;
  porCobrar: string;
  ventas: number;
  ventasPagadas: number;
}

export async function resumenVentas(tenantId: bigint, sedeId: bigint | null): Promise<ResumenVentas> {
  const filas = await prisma.$queryRawUnsafe<{ recaudado: string; facturado: string; por_cobrar: string; ventas: bigint; pagadas: bigint }[]>(
    `SELECT
       COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.tenant_id = $1::bigint), 0)::text AS recaudado,
       COALESCE(SUM(total) FILTER (WHERE estado <> 'anulada'), 0)::text AS facturado,
       COALESCE(SUM(saldo) FILTER (WHERE estado IN ('pendiente_pago','parcial')), 0)::text AS por_cobrar,
       COUNT(*) FILTER (WHERE estado <> 'anulada') AS ventas,
       COUNT(*) FILTER (WHERE estado = 'pagada') AS pagadas
     FROM saas.ventas
     WHERE tenant_id = $1::bigint AND ($2::bigint IS NULL OR sede_id = $2::bigint)`,
    tenantId, sedeId,
  );
  const r = filas[0];
  return { recaudado: r.recaudado, facturado: r.facturado, porCobrar: r.por_cobrar, ventas: Number(r.ventas), ventasPagadas: Number(r.pagadas) };
}

export interface AvanceRifa {
  rifaId: bigint; codigo: string; nombre: string; estado: string; totalBoletas: number;
  pagadas: number; reservadas: number; disponibles: number; recaudo: string;
}

export async function avancePorRifa(tenantId: bigint, sedeId: bigint | null): Promise<AvanceRifa[]> {
  const filas = await prisma.$queryRawUnsafe<{ rifa_id: bigint; codigo: string; nombre: string; estado: string; total_boletas: number; pagadas: bigint; reservadas: bigint; disponibles: bigint; recaudo: string }[]>(
    `SELECT r.id AS rifa_id, r.codigo, r.nombre, r.estado, r.total_boletas,
            COUNT(b.*) FILTER (WHERE b.estado='pagada')     AS pagadas,
            COUNT(b.*) FILTER (WHERE b.estado='reservada')  AS reservadas,
            COUNT(b.*) FILTER (WHERE b.estado='disponible') AS disponibles,
            COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id=a.venta_id WHERE v.rifa_id=r.id), 0)::text AS recaudo
       FROM saas.rifas r
       LEFT JOIN saas.boletas b ON b.rifa_id = r.id
      WHERE r.tenant_id = $1::bigint AND ($2::bigint IS NULL OR r.sede_id = $2::bigint)
      GROUP BY r.id
      ORDER BY r.id DESC`,
    tenantId, sedeId,
  );
  return filas.map((f) => ({ rifaId: f.rifa_id, codigo: f.codigo, nombre: f.nombre, estado: f.estado, totalBoletas: f.total_boletas, pagadas: Number(f.pagadas), reservadas: Number(f.reservadas), disponibles: Number(f.disponibles), recaudo: f.recaudo }));
}

export interface EstadoAuditoria {
  integra: boolean; rotaEnId: string | null; totalEventos: number;
  recientes: { id: string; accion: string; entidad: string; actorTipo: string; fecha: Date; hash: string | null }[];
}

export async function verificarAuditoria(tenantId: bigint): Promise<EstadoAuditoria> {
  const [chk, total, recientes] = await Promise.all([
    prisma.$queryRawUnsafe<{ rota: bigint | null }[]>("SELECT saas.verificar_cadena_auditoria() AS rota"),
    prisma.auditoria.count({ where: { tenant_id: tenantId } }),
    prisma.auditoria.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "desc" }, take: 15, select: { id: true, accion: true, entidad_tipo: true, actor_tipo: true, creado_en: true, hash_encadenado: true } }),
  ]);
  const rota = chk[0].rota;
  return {
    integra: rota === null,
    rotaEnId: rota === null ? null : String(rota),
    totalEventos: total,
    recientes: recientes.map((e) => ({ id: String(e.id), accion: e.accion, entidad: e.entidad_tipo, actorTipo: e.actor_tipo, fecha: e.creado_en, hash: e.hash_encadenado })),
  };
}
