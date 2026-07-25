// Sedes de un tenant. El admin del tenant solo puede crear hasta `max_sedes`
// (autorizadas por el super-admin); para más, debe solicitarlo al super-admin.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const crearSedeSchema = z.object({
  nombre: z.string().min(2, "El nombre de la sede es obligatorio."),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
});

export async function listarSedes(tenantId: bigint) {
  return prisma.sedes.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "asc" },
    include: { _count: { select: { rifas: true, ventas: true, usuarios: true } } },
  });
}

export async function crearSede(
  tenantId: bigint,
  maxSedes: number,
  input: unknown,
  actorId: bigint,
): Promise<Resultado> {
  const parsed = crearSedeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  try {
    return await prisma.$transaction(async (tx) => {
      // Serializa por tenant para no exceder el cupo en carreras.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext('sedes_tenant_' || $1::text))`,
        String(tenantId),
      );

      const actuales = await tx.sedes.count({ where: { tenant_id: tenantId } });
      if (actuales >= maxSedes) {
        return {
          ok: false as const,
          error: `Alcanzaste el máximo de ${maxSedes} sedes autorizadas. Solicita al super-admin ampliar el cupo.`,
        };
      }

      const dup = await tx.sedes.findFirst({ where: { tenant_id: tenantId, nombre: d.nombre } });
      if (dup) return { ok: false as const, error: "Ya existe una sede con ese nombre." };

      const sede = await tx.sedes.create({
        data: {
          tenant_id: tenantId,
          nombre: d.nombre,
          direccion: d.direccion || null,
          telefono: d.telefono || null,
          estado: "activa",
        },
      });
      await tx.$executeRawUnsafe(
        `SELECT saas.registrar_auditoria($1::bigint,'usuario','sede.crear','sede',$2::bigint,NULL,$3::jsonb,NULL,$4::bigint)`,
        actorId,
        sede.id,
        JSON.stringify({ nombre: d.nombre }),
        tenantId,
      );
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la sede." };
  }
}

export async function cambiarEstadoSede(
  sedeId: bigint,
  tenantId: bigint,
  estado: string,
  actorId: bigint,
): Promise<Resultado> {
  if (!["activa", "inactiva"].includes(estado)) return { ok: false, error: "Estado inválido." };
  const sede = await prisma.sedes.findFirst({ where: { id: sedeId, tenant_id: tenantId } });
  if (!sede) return { ok: false, error: "Sede no encontrada." };

  await prisma.$transaction(async (tx) => {
    await tx.sedes.update({ where: { id: sedeId }, data: { estado } });
    await tx.$executeRawUnsafe(
      `SELECT saas.registrar_auditoria($1::bigint,'usuario','sede.editar','sede',$2::bigint,$3::jsonb,$4::jsonb,NULL,$5::bigint)`,
      actorId,
      sedeId,
      JSON.stringify({ estado: sede.estado }),
      JSON.stringify({ estado }),
      tenantId,
    );
  });
  return { ok: true };
}
