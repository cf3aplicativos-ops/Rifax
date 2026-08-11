// Sedes de un tenant. El admin del tenant solo puede crear hasta `max_sedes`
// (autorizadas por el super-admin); para más, debe solicitarlo al super-admin.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { mensajeError } from "@/lib/errores";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Los tres campos del administrador de la sede son opcionales, pero si se
// diligencia uno, se exigen los tres (no tiene sentido una mitad de cuenta).
export const crearSedeSchema = z
  .object({
    nombre: z.string().min(2, "El nombre de la sede es obligatorio."),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    admin_nombre: z.string().optional(),
    admin_correo: z.string().optional(),
    admin_password: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const algunCampo = d.admin_nombre || d.admin_correo || d.admin_password;
    if (!algunCampo) return;
    if (!d.admin_nombre || d.admin_nombre.trim().length < 3) {
      ctx.addIssue({ code: "custom", message: "El nombre del administrador de la sede debe tener al menos 3 caracteres.", path: ["admin_nombre"] });
    }
    if (!d.admin_correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.admin_correo)) {
      ctx.addIssue({ code: "custom", message: "Correo del administrador de la sede inválido.", path: ["admin_correo"] });
    }
    if (!d.admin_password || d.admin_password.length < 8) {
      ctx.addIssue({ code: "custom", message: "La contraseña del administrador de la sede debe tener al menos 8 caracteres.", path: ["admin_password"] });
    }
  });

export async function listarSedes(tenantId: bigint) {
  return prisma.sedes.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "asc" },
    include: {
      _count: { select: { rifas: true, ventas: true, usuarios: true } },
      // Administrador propio de la sede (si lo tiene), para poder enlazar a
      // sus credenciales desde la edición de la sede.
      usuarios: { where: { roles: { nombre: "admin" } }, select: { id: true, nombre: true }, take: 1 },
    },
  });
}

export async function crearSede(
  tenantId: bigint,
  maxSedes: number,
  input: unknown,
  actorId: bigint,
): Promise<Resultado<{ sedeId: string; adminId: string | null }>> {
  const parsed = crearSedeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;
  const crearAdmin = Boolean(d.admin_correo);
  // Se calcula fuera de la transacción para no retener el lock de sedes
  // mientras se hashea (operación de CPU, no de base de datos).
  const adminHash = crearAdmin ? await hashPassword(d.admin_password!) : null;

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

      let rolAdminId: bigint | null = null;
      if (crearAdmin) {
        const dupCorreo = await tx.usuarios.findFirst({ where: { tenant_id: tenantId, correo: d.admin_correo! } });
        if (dupCorreo) return { ok: false as const, error: "Ya existe otro usuario con ese correo en tu empresa." };
        const rolAdmin = await tx.roles.findUnique({ where: { nombre: "admin" } });
        if (!rolAdmin) return { ok: false as const, error: "No existe el rol 'admin' (esquema incompleto)." };
        rolAdminId = rolAdmin.id;
      }

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

      // Administrador propio de la sede: mismo rol "admin" que el general de
      // la empresa, pero acotado a esta sede (sede_id) — así cada sede
      // gestiona su propio día a día (rifas, ventas, cartera) de forma
      // independiente, sin depender del administrador general.
      let adminId: bigint | null = null;
      if (crearAdmin && rolAdminId) {
        const admin = await tx.usuarios.create({
          data: {
            tenant_id: tenantId,
            nombre: d.admin_nombre!,
            correo: d.admin_correo!,
            password_hash: adminHash!,
            rol_id: rolAdminId,
            sede_id: sede.id,
            estado: "activo",
          },
        });
        adminId = admin.id;
        await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, admin.id);
        await tx.$executeRawUnsafe(
          `SELECT saas.registrar_auditoria($1::bigint,'usuario','usuario.crear','usuario',$2::bigint,NULL,$3::jsonb,NULL,$4::bigint)`,
          actorId,
          admin.id,
          JSON.stringify({ correo: d.admin_correo, rol: "admin", sede: d.nombre }),
          tenantId,
        );
      }

      return { ok: true as const, data: { sedeId: String(sede.id), adminId: adminId ? String(adminId) : null } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al crear la sede.") };
  }
}

export const editarSedeSchema = z.object({
  nombre: z.string().min(2, "El nombre de la sede es obligatorio."),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
});

export async function editarSede(
  sedeId: bigint,
  tenantId: bigint,
  input: unknown,
  actorId: bigint,
): Promise<Resultado> {
  const parsed = editarSedeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const sede = await prisma.sedes.findFirst({ where: { id: sedeId, tenant_id: tenantId } });
  if (!sede) return { ok: false, error: "Sede no encontrada." };

  const dup = await prisma.sedes.findFirst({ where: { tenant_id: tenantId, nombre: d.nombre, NOT: { id: sedeId } } });
  if (dup) return { ok: false, error: "Ya existe otra sede con ese nombre." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sedes.update({ where: { id: sedeId }, data: { nombre: d.nombre, direccion: d.direccion || null, telefono: d.telefono || null } });
      await tx.$executeRawUnsafe(
        `SELECT saas.registrar_auditoria($1::bigint,'usuario','sede.editar','sede',$2::bigint,$3::jsonb,$4::jsonb,NULL,$5::bigint)`,
        actorId, sedeId, JSON.stringify({ nombre: sede.nombre }), JSON.stringify({ nombre: d.nombre }), tenantId,
      );
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar la sede.") };
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
