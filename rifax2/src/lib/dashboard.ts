// Dashboard del administrador: estado de todas las sedes del tenant.
import "server-only";
import { prisma } from "@/lib/prisma";

export interface EstadoSede {
  id: bigint;
  nombre: string;
  estado: string;
  rifasActivas: number;
  ventas: number;
  recaudado: string;
  cartera: string;
}

export async function estadoSedes(tenantId: bigint): Promise<EstadoSede[]> {
  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; nombre: string; estado: string; rifas_activas: bigint; ventas: bigint; recaudado: string; cartera: string }[]
  >(
    `SELECT s.id, s.nombre, s.estado,
       (SELECT COUNT(*) FROM saas.rifas r WHERE r.sede_id = s.id AND r.estado = 'activa') AS rifas_activas,
       (SELECT COUNT(*) FROM saas.ventas v WHERE v.sede_id = s.id AND v.estado <> 'anulada') AS ventas,
       COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id WHERE v.sede_id = s.id), 0)::text AS recaudado,
       COALESCE((SELECT SUM(v.saldo) FROM saas.ventas v WHERE v.sede_id = s.id AND v.estado IN ('pendiente_pago','parcial')), 0)::text AS cartera
     FROM saas.sedes s
     WHERE s.tenant_id = $1::bigint
     ORDER BY s.nombre`,
    tenantId,
  );
  return filas.map((f) => ({
    id: f.id, nombre: f.nombre, estado: f.estado,
    rifasActivas: Number(f.rifas_activas), ventas: Number(f.ventas),
    recaudado: f.recaudado, cartera: f.cartera,
  }));
}
