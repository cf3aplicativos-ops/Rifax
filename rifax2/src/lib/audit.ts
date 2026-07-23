// Auditoría con hash encadenado.
// Delega en la función de Postgres `registrar_auditoria(...)` definida en
// 0001_init.sql, que serializa la cadena con un advisory lock y calcula el
// hash SHA-256 encadenado al registro anterior.
import "server-only";

/**
 * Acepta tanto el cliente Prisma global como un cliente de transacción, para
 * poder auditar dentro de la MISMA transacción que el evento de negocio.
 */
export interface SqlRunner {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface EventoAuditoria {
  actorId?: bigint | null;
  actorTipo?: "usuario" | "sistema" | "ia";
  accion: string;
  entidadTipo: string;
  entidadId?: bigint | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

export async function auditar(
  db: SqlRunner,
  {
    actorId = null,
    actorTipo = "usuario",
    accion,
    entidadTipo,
    entidadId = null,
    antes = null,
    despues = null,
    ip = null,
  }: EventoAuditoria,
): Promise<bigint> {
  const rows = await db.$queryRawUnsafe<{ id: bigint }[]>(
    `SELECT registrar_auditoria($1::bigint,$2::text,$3::text,$4::text,$5::bigint,$6::jsonb,$7::jsonb,$8::inet) AS id`,
    actorId,
    actorTipo,
    accion,
    entidadTipo,
    entidadId,
    antes === null ? null : JSON.stringify(antes),
    despues === null ? null : JSON.stringify(despues),
    ip,
  );
  return rows[0].id;
}
