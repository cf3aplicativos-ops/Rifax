// Servicio del super-admin de plataforma: gestión de tenants (empresas cliente).
// Solo accesible desde el panel de super-admin.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generarVencimientos } from "@/lib/vencimientos";
import { mensajeError } from "@/lib/errores";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const periodicidadEnum = z.enum(["mensual", "semestral", "anual"]);

export const crearTenantSchema = z.object({
  nombre: z.string().min(3, "El nombre de la empresa debe tener al menos 3 caracteres."),
  slug: z
    .string()
    .min(2, "El identificador (slug) es obligatorio.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones."),
  plan: z.enum(["basico", "corporativo"]).default("basico"),
  sedes_ilimitadas: z.coerce.boolean().default(false),
  max_sedes: z.coerce.number().int().min(1).max(9999).default(1),
  usuarios_ilimitados: z.coerce.boolean().default(false),
  max_usuarios: z.coerce.number().int().min(1).max(99999).optional(),
  periodicidad: periodicidadEnum.default("mensual"),
  periodicidad_pago: periodicidadEnum.default("mensual"),
  fecha_inicio: z.string().optional(),
  admin_nombre: z.string().min(3, "El nombre del administrador es obligatorio."),
  admin_correo: z.string().email("Correo del administrador inválido."),
  admin_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export interface TenantFila {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  plan: string;
  max_sedes: number;
  sedes: number;
  usuarios: number;
  creado_en: Date;
}

export async function listarTenants(): Promise<TenantFila[]> {
  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; nombre: string; slug: string; estado: string; plan: string; max_sedes: number; sedes: bigint; usuarios: bigint; creado_en: Date }[]
  >(
    `SELECT t.id, t.nombre, t.slug, t.estado, t.plan, t.max_sedes,
            (SELECT COUNT(*) FROM saas.sedes s WHERE s.tenant_id = t.id) AS sedes,
            (SELECT COUNT(*) FROM saas.usuarios u WHERE u.tenant_id = t.id) AS usuarios,
            t.creado_en
       FROM saas.tenants t
      ORDER BY t.id DESC`,
  );
  return filas.map((t) => ({
    id: String(t.id), nombre: t.nombre, slug: t.slug, estado: t.estado, plan: t.plan,
    max_sedes: Number(t.max_sedes), sedes: Number(t.sedes), usuarios: Number(t.usuarios), creado_en: t.creado_en,
  }));
}

export async function crearTenant(
  input: unknown,
  superAdminId: bigint,
  logoUrl: string | null = null,
): Promise<Resultado> {
  const parsed = crearTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  const dup = await prisma.tenants.findUnique({ where: { slug: d.slug } });
  if (dup) return { ok: false, error: `Ya existe un tenant con el slug '${d.slug}'.` };

  const rolAdmin = await prisma.roles.findUnique({ where: { nombre: "admin" } });
  if (!rolAdmin) return { ok: false, error: "No existe el rol 'admin' (esquema incompleto)." };

  try {
    const hash = await hashPassword(d.admin_password);
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenants.create({
        data: {
          nombre: d.nombre,
          slug: d.slug,
          estado: "activo",
          max_sedes: d.sedes_ilimitadas ? 9999 : d.max_sedes,
          creado_por: superAdminId,
        },
      });
      // Campos de plan y vigencia (columnas fuera del modelo Prisma).
      await tx.$executeRawUnsafe(
        `UPDATE saas.tenants SET
           plan = $2::text,
           sedes_ilimitadas = $3::boolean,
           usuarios_ilimitados = $4::boolean,
           max_usuarios = $5,
           periodicidad = $6::text,
           periodicidad_pago = $7::text,
           fecha_inicio = COALESCE($8::date, CURRENT_DATE)
         WHERE id = $1::bigint`,
        tenant.id,
        d.plan,
        d.sedes_ilimitadas,
        d.usuarios_ilimitados,
        d.usuarios_ilimitados ? null : (d.max_usuarios ?? null),
        d.periodicidad,
        d.periodicidad_pago,
        d.fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_inicio) ? d.fecha_inicio : null,
      );
      // Genera el calendario de fechas de vencimiento (mensual=12, semestral=2, anual=1)
      // y sincroniza fecha_vencimiento con la próxima pendiente.
      await generarVencimientos(tx as typeof prisma, tenant.id, d.fecha_inicio ?? null, d.periodicidad);
      // Config de branding por defecto (con logo si se subió al crear la empresa).
      await tx.tenant_config.create({ data: { tenant_id: tenant.id, ...(logoUrl ? { logo_url: logoUrl } : {}) } });
      // Usuario administrador del tenant (sede_id NULL = acceso a todo el tenant)
      await tx.usuarios.create({
        data: {
          tenant_id: tenant.id,
          nombre: d.admin_nombre,
          correo: d.admin_correo,
          password_hash: hash,
          rol_id: rolAdmin.id,
          estado: "activo",
        },
      });
      // Auditoría (acción de plataforma, sin usuario de tenant como actor)
      await tx.$executeRawUnsafe(
        `SELECT saas.registrar_auditoria($1::bigint,'superadmin','tenant.crear','tenant',$2::bigint,NULL,$3::jsonb,NULL,$2::bigint)`,
        superAdminId,
        tenant.id,
        JSON.stringify({ nombre: d.nombre, slug: d.slug, max_sedes: d.max_sedes }),
      );
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al crear el tenant.") };
  }
}

export async function cambiarEstadoTenant(
  tenantId: bigint,
  estado: string,
  superAdminId: bigint,
): Promise<Resultado> {
  if (!["activo", "suspendido", "inactivo"].includes(estado)) {
    return { ok: false, error: "Estado inválido." };
  }
  const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.tenants.update({ where: { id: tenantId }, data: { estado } });
    // Al suspender/inactivar, se revocan las sesiones de todos sus usuarios.
    if (estado !== "activo") {
      await tx.$executeRawUnsafe(
        `UPDATE saas.sesiones s SET revocada = true
           FROM saas.usuarios u
          WHERE s.usuario_id = u.id AND u.tenant_id = $1::bigint AND s.revocada = false`,
        tenantId,
      );
    }
    await tx.$executeRawUnsafe(
      `SELECT saas.registrar_auditoria($1::bigint,'superadmin','tenant.estado','tenant',$2::bigint,$3::jsonb,$4::jsonb,NULL,$2::bigint)`,
      superAdminId,
      tenantId,
      JSON.stringify({ estado: tenant.estado }),
      JSON.stringify({ estado }),
    );
  });
  return { ok: true };
}

export async function cambiarMaxSedes(
  tenantId: bigint,
  maxSedes: number,
  superAdminId: bigint,
): Promise<Resultado> {
  if (!Number.isInteger(maxSedes) || maxSedes < 1) {
    return { ok: false, error: "El número de sedes debe ser un entero ≥ 1." };
  }
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { sedes: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  if (maxSedes < tenant._count.sedes) {
    return {
      ok: false,
      error: `El tenant ya tiene ${tenant._count.sedes} sedes; no puede bajar de ese número.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenants.update({ where: { id: tenantId }, data: { max_sedes: maxSedes } });
    await tx.$executeRawUnsafe(
      `SELECT saas.registrar_auditoria($1::bigint,'superadmin','tenant.max_sedes','tenant',$2::bigint,$3::jsonb,$4::jsonb,NULL,$2::bigint)`,
      superAdminId,
      tenantId,
      JSON.stringify({ max_sedes: tenant.max_sedes }),
      JSON.stringify({ max_sedes: maxSedes }),
    );
  });
  return { ok: true };
}

/** Purga TODOS los datos del tenant (ON DELETE CASCADE borra su grafo completo). */
export async function purgarTenant(tenantId: bigint): Promise<Resultado> {
  const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  try {
    await prisma.$executeRawUnsafe(`SELECT saas.purgar_tenant($1::bigint)`, tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al purgar el tenant.") };
  }
}
