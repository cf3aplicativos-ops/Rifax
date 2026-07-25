// Helper de auditoría (multi-tenant). Invoca la función de Postgres
// saas.registrar_auditoria dentro de la misma transacción del evento de negocio,
// manteniendo la cadena de hash encadenado.
import "server-only";

export interface SqlRunner {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface EventoAuditoria {
  tenantId?: bigint | null;
  actorId?: bigint | null;
  actorTipo?: "usuario" | "sistema" | "ia" | "superadmin";
  accion: string;
  entidadTipo: string;
  entidadId?: bigint | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

export async function auditar(db: SqlRunner, e: EventoAuditoria): Promise<void> {
  await db.$executeRawUnsafe(
    `SELECT saas.registrar_auditoria($1::bigint,$2::text,$3::text,$4::text,$5::bigint,$6::jsonb,$7::jsonb,$8::inet,$9::bigint)`,
    e.actorId ?? null,
    e.actorTipo ?? "usuario",
    e.accion,
    e.entidadTipo,
    e.entidadId ?? null,
    e.antes === undefined || e.antes === null ? null : JSON.stringify(e.antes),
    e.despues === undefined || e.despues === null ? null : JSON.stringify(e.despues),
    e.ip ?? null,
    e.tenantId ?? null,
  );
}
