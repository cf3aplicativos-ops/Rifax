// Procesador del outbox de notificaciones (multi-tenant). Toma segura ante
// concurrencia (FOR UPDATE SKIP LOCKED) y reintentos con backoff. Filtra por
// tenant en el panel; el cron procesa todos los tenants.
import "server-only";
import { prisma } from "@/lib/prisma";

const MAX_INTENTOS = 5;

export async function resumenOutbox(tenantId: bigint) {
  const filas = await prisma.outbox_notificaciones.groupBy({ by: ["estado"], where: { tenant_id: tenantId }, _count: { _all: true } });
  const r: Record<string, number> = {};
  for (const f of filas) r[f.estado] = f._count._all;
  return r;
}

export async function listarOutbox(tenantId: bigint, limite = 50) {
  return prisma.outbox_notificaciones.findMany({ where: { tenant_id: tenantId }, orderBy: { id: "desc" }, take: limite });
}

async function entregar(_evento: string, _canal: string, _payload: unknown): Promise<boolean> {
  // Sin proveedor real integrado: se considera entregada.
  return true;
}

/** Procesa hasta `lote` notificaciones pendientes; si `tenantId` es null, todos. */
export async function procesarOutbox(tenantId: bigint | null, lote = 20): Promise<{ enviadas: number; fallidas: number }> {
  let enviadas = 0, fallidas = 0;
  for (let i = 0; i < lote; i++) {
    const r = await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; evento: string; canal: string; payload: unknown; intentos: number }[]>(
        `SELECT id, evento, canal, payload, intentos FROM saas.outbox_notificaciones
          WHERE estado='pendiente' AND (proximo_intento IS NULL OR proximo_intento <= now())
            AND ($1::bigint IS NULL OR tenant_id = $1::bigint)
          ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`,
        tenantId,
      );
      const f = filas[0];
      if (!f) return "vacio" as const;
      await tx.outbox_notificaciones.update({ where: { id: f.id }, data: { estado: "procesando" } });
      let ok = false;
      try { ok = await entregar(f.evento, f.canal, f.payload); } catch { ok = false; }
      const intentos = f.intentos + 1;
      if (ok) {
        await tx.outbox_notificaciones.update({ where: { id: f.id }, data: { estado: "enviado", intentos } });
        return "enviada" as const;
      }
      if (intentos >= MAX_INTENTOS) {
        await tx.outbox_notificaciones.update({ where: { id: f.id }, data: { estado: "fallido", intentos } });
      } else {
        await tx.outbox_notificaciones.update({ where: { id: f.id }, data: { estado: "pendiente", intentos, proximo_intento: new Date(Date.now() + Math.pow(2, intentos) * 60_000) } });
      }
      return "fallida" as const;
    });
    if (r === "vacio") break;
    if (r === "enviada") enviadas++;
    if (r === "fallida") fallidas++;
  }
  return { enviadas, fallidas };
}
