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
       COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
                  WHERE v.sede_id = s.id AND v.estado <> 'anulada'), 0)::text AS recaudado,
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

export async function boletasPorEstado(tenantId: bigint, sedeId: bigint | null) {
  const filas = await prisma.$queryRawUnsafe<{ estado: string; n: bigint }[]>(
    `SELECT b.estado, COUNT(*) AS n
       FROM saas.boletas b JOIN saas.rifas r ON r.id = b.rifa_id
      WHERE b.tenant_id = $1::bigint AND ($2::bigint IS NULL OR COALESCE(b.sede_id, r.sede_id) = $2::bigint)
      GROUP BY b.estado`,
    tenantId, sedeId,
  );
  const m: Record<string, number> = { disponible: 0, reservada: 0, pagada: 0, anulada: 0, bloqueada: 0 };
  for (const f of filas) m[f.estado] = Number(f.n);
  return m;
}

export interface TopVendedor {
  id: bigint;
  nombre: string;
  pctComision: number;
  ventas: number;
  recaudado: string;
}

export async function topVendedores(tenantId: bigint, sedeId: bigint, limite = 10): Promise<TopVendedor[]> {
  // El ORDER BY va sobre la columna NUMÉRICA del CTE (`recaudado_num`), no sobre
  // el alias de salida: ordenar por el texto comparaba '9000' > '20000'
  // lexicográficamente y devolvía un "top" incorrecto, además de recortar mal el
  // LIMIT. Ojo con el nombre: en ORDER BY un identificador simple resuelve
  // primero contra los alias de SELECT, así que la columna numérica debe
  // llamarse distinto del alias de salida.
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; nombre: string; pct: string; ventas: bigint; recaudado: string }[]>(
    `WITH base AS (
       SELECT ve.id, ve.nombre, ve.pct_comision AS pct_num,
         (SELECT COUNT(*) FROM saas.ventas v WHERE v.vendedor_id = ve.id AND v.sede_id = $2::bigint AND v.estado <> 'anulada') AS ventas_num,
         COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
                    WHERE v.vendedor_id = ve.id AND v.sede_id = $2::bigint AND v.estado <> 'anulada'), 0) AS recaudado_num
       FROM saas.vendedores ve
       WHERE ve.tenant_id = $1::bigint
     )
     SELECT id, nombre, pct_num::text AS pct, ventas_num AS ventas, recaudado_num::text AS recaudado
       FROM base
      ORDER BY recaudado_num DESC, ventas_num DESC
      LIMIT $3::int`,
    tenantId, sedeId, limite,
  );
  return filas
    .map((f) => ({ id: f.id, nombre: f.nombre, pctComision: Number(f.pct), ventas: Number(f.ventas), recaudado: f.recaudado }))
    .filter((v) => v.ventas > 0 || Number(v.recaudado) > 0);
}

// Top de vendedores del tenant (todas las sedes) por recaudo y nº de ventas.
export async function topVendedoresTenant(tenantId: bigint, limite = 10): Promise<TopVendedor[]> {
  // Mismo criterio que topVendedores: ordenar por las columnas numéricas del CTE.
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; nombre: string; pct: string; ventas: bigint; recaudado: string }[]>(
    `WITH base AS (
       SELECT ve.id, ve.nombre, ve.pct_comision AS pct_num,
         (SELECT COUNT(*) FROM saas.ventas v WHERE v.vendedor_id = ve.id AND v.estado <> 'anulada') AS ventas_num,
         COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
                    WHERE v.vendedor_id = ve.id AND v.estado <> 'anulada'), 0) AS recaudado_num
       FROM saas.vendedores ve
       WHERE ve.tenant_id = $1::bigint
     )
     SELECT id, nombre, pct_num::text AS pct, ventas_num AS ventas, recaudado_num::text AS recaudado
       FROM base
      ORDER BY recaudado_num DESC, ventas_num DESC
      LIMIT $2::int`,
    tenantId, limite,
  );
  return filas
    .map((f) => ({ id: f.id, nombre: f.nombre, pctComision: Number(f.pct), ventas: Number(f.ventas), recaudado: f.recaudado }))
    .filter((v) => v.ventas > 0 || Number(v.recaudado) > 0);
}

export async function carteraPorTramo(tenantId: bigint, sedeId: bigint | null) {
  const filas = await prisma.$queryRawUnsafe<{ tramo: string; saldo: string; cuentas: bigint }[]>(
    `SELECT CASE
              WHEN now() - creado_en <= INTERVAL '7 days'  THEN 'corriente'
              WHEN now() - creado_en <= INTERVAL '15 days' THEN 'mora_1'
              WHEN now() - creado_en <= INTERVAL '30 days' THEN 'mora_2'
              ELSE 'mora_3' END AS tramo,
            COALESCE(SUM(saldo),0)::text AS saldo, COUNT(*) AS cuentas
       FROM saas.ventas
      WHERE tenant_id = $1::bigint AND ($2::bigint IS NULL OR sede_id = $2::bigint)
        AND estado IN ('pendiente_pago','parcial') AND saldo > 0
      GROUP BY tramo`,
    tenantId, sedeId,
  );
  const orden = ["corriente", "mora_1", "mora_2", "mora_3"];
  return orden.map((t) => {
    const f = filas.find((x) => x.tramo === t);
    return { tramo: t, saldo: f ? Number(f.saldo) : 0, cuentas: f ? Number(f.cuentas) : 0 };
  });
}
