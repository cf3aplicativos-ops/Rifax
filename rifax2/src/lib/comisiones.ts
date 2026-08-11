// Comisiones de vendedores. Comisión ganada = recaudado de sus ventas ×
// % de comisión. Se puede liquidar (pagar) el pendiente, individual o masivo.
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { capacidades } from "@/lib/planes";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export interface ComisionVendedor {
  id: bigint;
  nombre: string;
  pct: number;
  recaudado: number;
  comisionGanada: number;
  liquidado: number;
  pendiente: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Comisión ganada = recaudado × % de comisión, redondeado a 2 decimales. */
export function calcularComision(recaudado: number, pct: number): number {
  return r2((recaudado * pct) / 100);
}

/** Pendiente por liquidar = comisión ganada - lo ya liquidado, redondeado a 2 decimales. */
export function calcularPendiente(comisionGanada: number, liquidado: number): number {
  return r2(comisionGanada - liquidado);
}

export async function estadoComisiones(tenantId: bigint): Promise<ComisionVendedor[]> {
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; nombre: string; pct: string; recaudado: string; liquidado: string }[]>(
    `SELECT ve.id, ve.nombre, ve.pct_comision::text AS pct,
       COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
                  WHERE v.vendedor_id = ve.id AND v.estado <> 'anulada'), 0)::text AS recaudado,
       COALESCE((SELECT SUM(l.monto) FROM saas.liquidaciones l WHERE l.vendedor_id = ve.id), 0)::text AS liquidado
     FROM saas.vendedores ve
     WHERE ve.tenant_id = $1::bigint
     ORDER BY ve.nombre`,
    tenantId,
  );
  return filas.map((f) => {
    const pct = Number(f.pct);
    const recaudado = Number(f.recaudado);
    const comisionGanada = calcularComision(recaudado, pct);
    const liquidado = Number(f.liquidado);
    return { id: f.id, nombre: f.nombre, pct, recaudado, comisionGanada, liquidado, pendiente: calcularPendiente(comisionGanada, liquidado) };
  });
}

export async function comisionVendedor(tenantId: bigint, vendedorId: bigint): Promise<ComisionVendedor | null> {
  const todas = await estadoComisiones(tenantId);
  return todas.find((c) => c.id === vendedorId) ?? null;
}

// Detalle por venta (aparte del consolidado por vendedor): cada fila es una
// venta con comisión, con sus números de boleta — para auditar de dónde sale
// la comisión de cada vendedor, no solo el total.
export interface ComisionDetalle {
  ventaId: string;
  codigo: string;
  fecha: Date;
  vendedorId: string;
  vendedorNombre: string;
  pct: number;
  rifaCodigo: string;
  cliente: string;
  boletas: number[];
  recaudadoVenta: number;
  comisionVenta: number;
}

export async function comisionesDetalladas(tenantId: bigint, sedeId: bigint | null): Promise<ComisionDetalle[]> {
  const filas = await prisma.$queryRawUnsafe<
    { venta_id: bigint; codigo: string; creado_en: Date; vendedor_id: bigint; vendedor_nombre: string; pct: string; rifa_codigo: string; cliente_nombre: string; recaudado_venta: string }[]
  >(
    `SELECT v.id AS venta_id, v.codigo, v.creado_en,
            ve.id AS vendedor_id, ve.nombre AS vendedor_nombre, ve.pct_comision::text AS pct,
            r.codigo AS rifa_codigo, c.nombre AS cliente_nombre,
            COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0)::text AS recaudado_venta
       FROM saas.ventas v
       JOIN saas.vendedores ve ON ve.id = v.vendedor_id
       JOIN saas.rifas r ON r.id = v.rifa_id
       JOIN saas.clientes c ON c.id = v.cliente_id
      WHERE v.tenant_id = $1::bigint AND v.estado <> 'anulada' AND v.vendedor_id IS NOT NULL
        AND ($2::bigint IS NULL OR v.sede_id = $2::bigint)
      ORDER BY v.id DESC`,
    tenantId, sedeId,
  );

  const ventaIds = filas.map((f) => f.venta_id);
  const boletasFilas = ventaIds.length
    ? await prisma.$queryRawUnsafe<{ venta_id: bigint; numero: number }[]>(
        `SELECT vb.venta_id, b.numero FROM saas.ventas_boletas vb JOIN saas.boletas b ON b.id = vb.boleta_id
          WHERE vb.venta_id = ANY($1::bigint[]) ORDER BY b.numero`,
        ventaIds,
      )
    : [];
  const boletasPorVenta = new Map<string, number[]>();
  for (const b of boletasFilas) {
    const k = String(b.venta_id);
    if (!boletasPorVenta.has(k)) boletasPorVenta.set(k, []);
    boletasPorVenta.get(k)!.push(b.numero);
  }

  return filas.map((f) => {
    const recaudadoVenta = Number(f.recaudado_venta);
    const pct = Number(f.pct);
    return {
      ventaId: String(f.venta_id), codigo: f.codigo, fecha: f.creado_en,
      vendedorId: String(f.vendedor_id), vendedorNombre: f.vendedor_nombre, pct,
      rifaCodigo: f.rifa_codigo, cliente: f.cliente_nombre,
      boletas: boletasPorVenta.get(String(f.venta_id)) ?? [],
      recaudadoVenta, comisionVenta: calcularComision(recaudadoVenta, pct),
    };
  });
}

// Inserta la liquidación calculando el pendiente EN POSTGRES y dentro de la
// transacción, en vez de confiar en el valor leído antes de abrirla: dos clics
// simultáneos (o dos pestañas) liquidaban dos veces la misma comisión, porque
// ambos leían el mismo `pendiente` antes de que el otro insertara su fila.
// Devuelve el monto realmente liquidado, o null si ya no quedaba pendiente.
async function registrarLiquidacion(
  tx: typeof prisma,
  tenantId: bigint,
  c: ComisionVendedor,
  actorId: bigint,
): Promise<number | null> {
  // Serializa por vendedor: el cálculo y la inserción quedan atómicos frente a
  // otra liquidación concurrente del mismo vendedor.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('liquidacion_vendedor_' || $1::text))`, String(c.id));
  const filas = await tx.$queryRawUnsafe<{ monto: string }[]>(
    `WITH calc AS (
       SELECT ve.id, ve.pct_comision AS pct,
         COALESCE((SELECT SUM(a.monto) FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
                    WHERE v.vendedor_id = ve.id AND v.estado <> 'anulada'), 0) AS recaudado,
         COALESCE((SELECT SUM(l.monto) FROM saas.liquidaciones l WHERE l.vendedor_id = ve.id), 0) AS liquidado
         FROM saas.vendedores ve
        WHERE ve.id = $2::bigint AND ve.tenant_id = $1::bigint
     )
     INSERT INTO saas.liquidaciones (tenant_id, vendedor_id, monto, base_recaudado, pct_comision, liquidado_por)
     SELECT $1::bigint, calc.id,
            round(calc.recaudado * calc.pct / 100, 2) - calc.liquidado,
            calc.recaudado, calc.pct, $3::bigint
       FROM calc
      WHERE round(calc.recaudado * calc.pct / 100, 2) - calc.liquidado > 0
     RETURNING monto::text AS monto`,
    tenantId, c.id, actorId,
  );
  const monto = filas[0]?.monto;
  if (monto === undefined) return null;
  await auditar(tx, { tenantId, actorId, accion: "pago.conciliar", entidadTipo: "liquidacion", entidadId: c.id, despues: { vendedor: c.nombre, monto, base: c.recaudado } });
  return Number(monto);
}

export async function liquidarVendedor(tenantId: bigint, vendedorId: bigint, actorId: bigint): Promise<Resultado<{ monto: number }>> {
  const c = await comisionVendedor(tenantId, vendedorId);
  if (!c) return { ok: false, error: "Vendedor no encontrado." };
  if (c.pendiente <= 0) return { ok: false, error: "No hay comisión pendiente por liquidar." };
  const monto = await prisma.$transaction((tx) => registrarLiquidacion(tx as typeof prisma, tenantId, c, actorId));
  if (monto === null) return { ok: false, error: "No hay comisión pendiente por liquidar." };
  return { ok: true, data: { monto } };
}

export async function liquidarMasivo(tenantId: bigint, actorId: bigint): Promise<Resultado<{ vendedores: number; total: number }>> {
  // Función del plan Corporativo.
  const planFilas = await prisma.$queryRawUnsafe<{ plan: string }[]>(`SELECT plan FROM saas.tenants WHERE id=$1::bigint`, tenantId);
  if (!capacidades(planFilas[0]?.plan).liquidacionMasiva) {
    return { ok: false, error: "La liquidación masiva está disponible en el plan Corporativo." };
  }
  const todas = await estadoComisiones(tenantId);
  const pendientes = todas.filter((c) => c.pendiente > 0);
  if (pendientes.length === 0) return { ok: false, error: "No hay comisiones pendientes por liquidar." };
  let total = 0;
  let liquidados = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of pendientes) {
      const monto = await registrarLiquidacion(tx as typeof prisma, tenantId, c, actorId);
      // null = otra liquidación concurrente ya cubrió el pendiente de ese vendedor.
      if (monto !== null) { total += monto; liquidados++; }
    }
  });
  if (liquidados === 0) return { ok: false, error: "No hay comisiones pendientes por liquidar." };
  return { ok: true, data: { vendedores: liquidados, total: r2(total) } };
}
