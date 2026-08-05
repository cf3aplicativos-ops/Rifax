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

async function registrarLiquidacion(tx: typeof prisma, tenantId: bigint, c: ComisionVendedor, actorId: bigint) {
  await tx.$executeRawUnsafe(
    `INSERT INTO saas.liquidaciones (tenant_id, vendedor_id, monto, base_recaudado, pct_comision, liquidado_por)
     VALUES ($1::bigint, $2::bigint, $3::numeric, $4::numeric, $5::numeric, $6::bigint)`,
    tenantId, c.id, String(c.pendiente), String(c.recaudado), String(c.pct), actorId,
  );
  await auditar(tx, { tenantId, actorId, accion: "pago.conciliar", entidadTipo: "liquidacion", entidadId: c.id, despues: { vendedor: c.nombre, monto: c.pendiente, base: c.recaudado } });
}

export async function liquidarVendedor(tenantId: bigint, vendedorId: bigint, actorId: bigint): Promise<Resultado<{ monto: number }>> {
  const c = await comisionVendedor(tenantId, vendedorId);
  if (!c) return { ok: false, error: "Vendedor no encontrado." };
  if (c.pendiente <= 0) return { ok: false, error: "No hay comisión pendiente por liquidar." };
  await prisma.$transaction((tx) => registrarLiquidacion(tx as typeof prisma, tenantId, c, actorId));
  return { ok: true, data: { monto: c.pendiente } };
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
  await prisma.$transaction(async (tx) => {
    for (const c of pendientes) {
      await registrarLiquidacion(tx as typeof prisma, tenantId, c, actorId);
      total += c.pendiente;
    }
  });
  return { ok: true, data: { vendedores: pendientes.length, total: r2(total) } };
}
