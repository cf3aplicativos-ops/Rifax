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
    // `recaudado` sumaba TODOS los abonos del tenant (incluidos los de otras sedes
    // y los de ventas anuladas) mientras facturado/porCobrar sí respetaban la sede:
    // a un usuario acotado a una sede le mostraba el recaudo de toda la empresa.
    `SELECT
       COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v2 ON v2.id = a.venta_id
                  WHERE v2.tenant_id = $1::bigint AND v2.estado <> 'anulada'
                    AND ($2::bigint IS NULL OR v2.sede_id = $2::bigint)), 0)::text AS recaudado,
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
            COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id=a.venta_id
                       WHERE v.rifa_id=r.id AND v.estado <> 'anulada'), 0)::text AS recaudo
       FROM saas.rifas r
       LEFT JOIN saas.boletas b ON b.rifa_id = r.id
      WHERE r.tenant_id = $1::bigint AND ($2::bigint IS NULL OR r.sede_id = $2::bigint)
      GROUP BY r.id
      ORDER BY r.id DESC`,
    tenantId, sedeId,
  );
  return filas.map((f) => ({ rifaId: f.rifa_id, codigo: f.codigo, nombre: f.nombre, estado: f.estado, totalBoletas: f.total_boletas, pagadas: Number(f.pagadas), reservadas: Number(f.reservadas), disponibles: Number(f.disponibles), recaudo: f.recaudo }));
}

export interface VentaPorVendedor {
  vendedorId: string | null;
  vendedorNombre: string;
  sedeNombre: string;
  ventas: number;
  facturado: string;
  recaudado: string;
}

/** Desglose de ventas por vendedor (o "Punto de venta" si no tienen uno) y sede. */
export async function ventasPorVendedor(tenantId: bigint, sedeId: bigint | null): Promise<VentaPorVendedor[]> {
  const filas = await prisma.$queryRawUnsafe<
    { vendedor_id: bigint | null; vendedor_nombre: string; sede_nombre: string; ventas: bigint; facturado: string; recaudado: string }[]
  >(
    `WITH por_venta AS (
       SELECT v.id, v.vendedor_id, v.sede_id, v.total, v.estado,
              COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0) AS abonado
         FROM saas.ventas v
        WHERE v.tenant_id = $1::bigint AND ($2::bigint IS NULL OR v.sede_id = $2::bigint)
     )
     SELECT pv.vendedor_id,
            COALESCE(ve.nombre, 'Punto de venta') AS vendedor_nombre,
            s.nombre AS sede_nombre,
            COUNT(*) FILTER (WHERE pv.estado <> 'anulada') AS ventas,
            COALESCE(SUM(pv.total) FILTER (WHERE pv.estado <> 'anulada'), 0)::text AS facturado,
            COALESCE(SUM(pv.abonado), 0)::text AS recaudado
       FROM por_venta pv
       JOIN saas.sedes s ON s.id = pv.sede_id
       LEFT JOIN saas.vendedores ve ON ve.id = pv.vendedor_id
      GROUP BY pv.vendedor_id, ve.nombre, s.nombre
      ORDER BY SUM(pv.total) FILTER (WHERE pv.estado <> 'anulada') DESC NULLS LAST`,
    tenantId, sedeId,
  );
  return filas.map((f) => ({
    vendedorId: f.vendedor_id !== null ? String(f.vendedor_id) : null,
    vendedorNombre: f.vendedor_nombre,
    sedeNombre: f.sede_nombre,
    ventas: Number(f.ventas),
    facturado: f.facturado,
    recaudado: f.recaudado,
  }));
}

export interface RankingVendedor {
  posicion: number;
  vendedorId: string;
  vendedorNombre: string;
  sedeNombre: string;
  boletas: number;
  ventas: number;
  recaudado: string;
}

// Ranking de vendedores de UNA rifa (punto 15): solo vendedores reales (no
// "Punto de venta"), ordenado por recaudado. Se calcula en vivo a partir de
// ventas/abonos/boletas — no se congela una copia al cerrar la rifa, así que
// siempre refleja el estado real (por ejemplo, si se anula una venta después).
export async function rankingVendedores(tenantId: bigint, rifaId: bigint): Promise<RankingVendedor[]> {
  const filas = await prisma.$queryRawUnsafe<
    { vendedor_id: bigint; vendedor_nombre: string; sede_nombre: string; boletas: bigint; ventas: bigint; recaudado: string }[]
  >(
    `WITH por_venta AS (
       SELECT v.id, v.vendedor_id, v.estado,
              COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0) AS abonado,
              (SELECT COUNT(*) FROM saas.ventas_boletas vb WHERE vb.venta_id = v.id) AS num_boletas
         FROM saas.ventas v
        WHERE v.tenant_id = $1::bigint AND v.rifa_id = $2::bigint AND v.vendedor_id IS NOT NULL
     )
     SELECT pv.vendedor_id, ve.nombre AS vendedor_nombre, COALESCE(s.nombre, 'Todas las sedes') AS sede_nombre,
            COALESCE(SUM(pv.num_boletas) FILTER (WHERE pv.estado <> 'anulada'), 0) AS boletas,
            COUNT(*) FILTER (WHERE pv.estado <> 'anulada') AS ventas,
            COALESCE(SUM(pv.abonado), 0)::text AS recaudado
       FROM por_venta pv
       JOIN saas.vendedores ve ON ve.id = pv.vendedor_id
       LEFT JOIN saas.sedes s ON s.id = ve.sede_id
      GROUP BY pv.vendedor_id, ve.nombre, s.nombre
      ORDER BY SUM(pv.abonado) DESC, COALESCE(SUM(pv.num_boletas) FILTER (WHERE pv.estado <> 'anulada'), 0) DESC`,
    tenantId, rifaId,
  );
  return filas.map((f, i) => ({
    posicion: i + 1,
    vendedorId: String(f.vendedor_id),
    vendedorNombre: f.vendedor_nombre,
    sedeNombre: f.sede_nombre,
    boletas: Number(f.boletas),
    ventas: Number(f.ventas),
    recaudado: f.recaudado,
  }));
}

export interface EstadoAuditoria {
  integra: boolean; rotaEnId: string | null; totalEventos: number;
  ultimaPurgaGlobal: Date | null;
  recientes: { id: string; accion: string; entidad: string; actorTipo: string; fecha: Date; hash: string | null }[];
}

export async function verificarAuditoria(tenantId: bigint): Promise<EstadoAuditoria> {
  const [chk, total, recientes, purga] = await Promise.all([
    prisma.$queryRawUnsafe<{ rota: bigint | null }[]>("SELECT saas.verificar_cadena_auditoria() AS rota"),
    prisma.auditoria.count({ where: { tenant_id: tenantId } }),
    prisma.auditoria.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "desc" }, take: 15, select: { id: true, accion: true, entidad_tipo: true, actor_tipo: true, creado_en: true, hash_encadenado: true } }),
    // La cadena de hashes es global (no por tenant): si el super-admin de la
    // plataforma purgó historial viejo, se avisa aquí para que "íntegra" no
    // se malinterprete como "nunca se borró nada".
    prisma.$queryRawUnsafe<{ purgado_hasta: Date }[]>(`SELECT purgado_hasta FROM saas.auditoria_purgas ORDER BY id DESC LIMIT 1`),
  ]);
  const rota = chk[0].rota;
  return {
    integra: rota === null,
    rotaEnId: rota === null ? null : String(rota),
    totalEventos: total,
    ultimaPurgaGlobal: purga[0]?.purgado_hasta ?? null,
    recientes: recientes.map((e) => ({ id: String(e.id), accion: e.accion, entidad: e.entidad_tipo, actorTipo: e.actor_tipo, fecha: e.creado_en, hash: e.hash_encadenado })),
  };
}
