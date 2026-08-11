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
      const admin = await tx.usuarios.create({
        data: {
          tenant_id: tenant.id,
          nombre: d.admin_nombre,
          correo: d.admin_correo,
          password_hash: hash,
          rol_id: rolAdmin.id,
          estado: "activo",
        },
      });
      // Obliga a definir contraseña propia en el primer ingreso.
      await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, admin.id);
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

export interface TenantDetalle {
  id: string;
  nombre: string;
  slug: string;
  maxSedes: number;
  sedesIlimitadas: boolean;
  usuariosIlimitados: boolean;
  maxUsuarios: number | null;
  periodicidad: string;
  periodicidadPago: string;
  fechaInicio: string | null;
}

export async function obtenerTenant(tenantId: bigint): Promise<TenantDetalle | null> {
  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; nombre: string; slug: string; max_sedes: number; sedes_ilimitadas: boolean; usuarios_ilimitados: boolean; max_usuarios: number | null; periodicidad: string; periodicidad_pago: string; fecha_inicio: string | null }[]
  >(
    `SELECT id, nombre, slug, max_sedes, sedes_ilimitadas, usuarios_ilimitados, max_usuarios,
            periodicidad, periodicidad_pago, to_char(fecha_inicio,'YYYY-MM-DD') AS fecha_inicio
       FROM saas.tenants WHERE id = $1::bigint`,
    tenantId,
  );
  const t = filas[0];
  if (!t) return null;
  return {
    id: String(t.id), nombre: t.nombre, slug: t.slug, maxSedes: t.max_sedes,
    sedesIlimitadas: t.sedes_ilimitadas, usuariosIlimitados: t.usuarios_ilimitados,
    maxUsuarios: t.max_usuarios, periodicidad: t.periodicidad, periodicidadPago: t.periodicidad_pago,
    fechaInicio: t.fecha_inicio,
  };
}

export const editarTenantSchema = z.object({
  nombre: z.string().min(3, "El nombre de la empresa debe tener al menos 3 caracteres."),
  slug: z
    .string()
    .min(2, "El identificador (slug) es obligatorio.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones."),
  sedes_ilimitadas: z.coerce.boolean().default(false),
  max_sedes: z.coerce.number().int().min(1).max(9999).default(1),
  usuarios_ilimitados: z.coerce.boolean().default(false),
  max_usuarios: z.coerce.number().int().min(1).max(99999).optional(),
  periodicidad: periodicidadEnum.default("mensual"),
  periodicidad_pago: periodicidadEnum.default("mensual"),
  fecha_inicio: z.string().optional(),
});

// Edición general de una empresa: nombre, slug, cupos y vigencia. Si cambia
// la periodicidad o la fecha de inicio, se regenera el calendario de
// vencimientos (mismo criterio que el botón manual "Generar calendario").
export async function editarTenant(tenantId: bigint, input: unknown, superAdminId: bigint): Promise<Resultado> {
  const parsed = editarTenantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const actual = await prisma.tenants.findUnique({ where: { id: tenantId }, include: { _count: { select: { sedes: true } } } });
  if (!actual) return { ok: false, error: "Empresa no encontrada." };

  if (d.slug !== actual.slug) {
    const dup = await prisma.tenants.findUnique({ where: { slug: d.slug } });
    if (dup) return { ok: false, error: `Ya existe un tenant con el slug '${d.slug}'.` };
  }

  const nuevoMaxSedes = d.sedes_ilimitadas ? 9999 : d.max_sedes;
  if (!d.sedes_ilimitadas && nuevoMaxSedes < actual._count.sedes) {
    return { ok: false, error: `La empresa ya tiene ${actual._count.sedes} sedes; no puede bajar de ese número.` };
  }
  // Mismo criterio para el cupo de usuarios: bajarlo por debajo de los ya creados
  // dejaba al tenant en un estado imposible (no puede crear, pero tampoco cumple).
  if (!d.usuarios_ilimitados && d.max_usuarios != null) {
    const usuarios = await prisma.usuarios.count({ where: { tenant_id: tenantId } });
    if (d.max_usuarios < usuarios) {
      return { ok: false, error: `La empresa ya tiene ${usuarios} usuario(s); no puede bajar de ese número.` };
    }
  }

  const filas = await prisma.$queryRawUnsafe<{ periodicidad: string; fecha_inicio: string | null }[]>(
    `SELECT periodicidad, to_char(fecha_inicio,'YYYY-MM-DD') AS fecha_inicio FROM saas.tenants WHERE id = $1::bigint`,
    tenantId,
  );
  const antes = filas[0];
  const fechaInicioNueva = d.fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_inicio) ? d.fecha_inicio : null;
  const cambioCalendario = !!antes && (antes.periodicidad !== d.periodicidad || (fechaInicioNueva !== null && fechaInicioNueva !== antes.fecha_inicio));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenants.update({ where: { id: tenantId }, data: { nombre: d.nombre, slug: d.slug, max_sedes: nuevoMaxSedes } });
      await tx.$executeRawUnsafe(
        `UPDATE saas.tenants SET
           sedes_ilimitadas = $2::boolean,
           usuarios_ilimitados = $3::boolean,
           max_usuarios = $4,
           periodicidad = $5::text,
           periodicidad_pago = $6::text,
           fecha_inicio = COALESCE($7::date, fecha_inicio),
           actualizado_en = now()
         WHERE id = $1::bigint`,
        tenantId,
        d.sedes_ilimitadas,
        d.usuarios_ilimitados,
        d.usuarios_ilimitados ? null : (d.max_usuarios ?? null),
        d.periodicidad,
        d.periodicidad_pago,
        fechaInicioNueva,
      );
      if (cambioCalendario) {
        await generarVencimientos(tx as typeof prisma, tenantId, fechaInicioNueva ?? antes?.fecha_inicio ?? null, d.periodicidad);
      }
      await tx.$executeRawUnsafe(
        `SELECT saas.registrar_auditoria($1::bigint,'superadmin','tenant.editar','tenant',$2::bigint,$3::jsonb,$4::jsonb,NULL,$2::bigint)`,
        superAdminId,
        tenantId,
        JSON.stringify({ nombre: actual.nombre, slug: actual.slug }),
        JSON.stringify({ nombre: d.nombre, slug: d.slug }),
      );
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar la empresa.") };
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

// Auditoría (#25): la cadena de hashes es GLOBAL (abarca todos los tenants),
// así que solo el super-admin de la plataforma puede purgarla — nunca un
// admin de tenant, que solo debe poder consultar y descargar la suya (ver
// verificarAuditoria en reportes.ts). No se permite borrar nada más reciente
// que RETENCION_MINIMA_DIAS: la purga es para archivar historial viejo, no
// para "limpiar" actividad reciente.
const RETENCION_MINIMA_DIAS = 365;

export interface EstadoAuditoriaGlobal {
  integra: boolean;
  rotaEnId: string | null;
  totalEventos: number;
  ultimaPurga: { fecha: Date; purgadoHasta: Date; filasBorradas: number } | null;
  // Reinicios de cadena documentados: purgas por antigüedad (auditoria_purgas)
  // + huecos dejados por purgar_tenant() al borrar un tenant (auditoria_reinicios,
  // ver migración 0020). Ninguno cuenta como alteración, pero conviene que
  // quede visible cuántos hay y por qué, no solo "íntegra: sí/no".
  totalReinicios: number;
}

export async function estadoAuditoriaGlobal(): Promise<EstadoAuditoriaGlobal> {
  const [chk, total, ultima, reinicios] = await Promise.all([
    prisma.$queryRawUnsafe<{ rota: bigint | null }[]>("SELECT saas.verificar_cadena_auditoria() AS rota"),
    prisma.auditoria.count(),
    prisma.$queryRawUnsafe<{ creado_en: Date; purgado_hasta: Date; filas_borradas: bigint }[]>(
      `SELECT creado_en, purgado_hasta, filas_borradas FROM saas.auditoria_purgas ORDER BY id DESC LIMIT 1`,
    ),
    prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT (SELECT count(*) FROM saas.auditoria_purgas) + (SELECT count(*) FROM saas.auditoria_reinicios) AS n`,
    ),
  ]);
  const rota = chk[0].rota;
  const u = ultima[0];
  return {
    integra: rota === null,
    rotaEnId: rota === null ? null : String(rota),
    totalEventos: total,
    ultimaPurga: u ? { fecha: u.creado_en, purgadoHasta: u.purgado_hasta, filasBorradas: Number(u.filas_borradas) } : null,
    totalReinicios: Number(reinicios[0].n),
  };
}

export interface PurgaFila {
  id: string;
  purgadoHasta: Date;
  filasBorradas: number;
  actorNombre: string | null;
  creadoEn: Date;
}

export async function historialPurgasAuditoria(): Promise<PurgaFila[]> {
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; purgado_hasta: Date; filas_borradas: bigint; actor_id: bigint | null; creado_en: Date }[]>(
    `SELECT id, purgado_hasta, filas_borradas, actor_id, creado_en FROM saas.auditoria_purgas ORDER BY id DESC LIMIT 20`,
  );
  const actorIds = [...new Set(filas.map((f) => f.actor_id).filter((id): id is bigint => id !== null))];
  const admins = actorIds.length
    ? await prisma.plataforma_admins.findMany({ where: { id: { in: actorIds } }, select: { id: true, nombre: true } })
    : [];
  const nombreDe = new Map(admins.map((a) => [String(a.id), a.nombre]));
  return filas.map((f) => ({
    id: String(f.id),
    purgadoHasta: f.purgado_hasta,
    filasBorradas: Number(f.filas_borradas),
    actorNombre: f.actor_id ? (nombreDe.get(String(f.actor_id)) ?? null) : null,
    creadoEn: f.creado_en,
  }));
}

/**
 * Purga el historial de auditoría anterior a `hasta` (mínimo un año atrás).
 * La cadena de hashes se reinicia de forma documentada: el evento de purga
 * (qué se borró, cuándo, quién) queda registrado en `auditoria_purgas` y
 * también como un evento más de la propia auditoría, encadenado con lo que
 * sobrevivió — verificarAuditoria() ya sabe reconocer ese punto de reinicio
 * y no lo reporta como alteración.
 */
export async function purgarAuditoria(hasta: Date, actorId: bigint): Promise<Resultado<{ filasBorradas: number }>> {
  if (Number.isNaN(hasta.getTime())) return { ok: false, error: "Fecha inválida." };
  const limite = new Date();
  limite.setDate(limite.getDate() - RETENCION_MINIMA_DIAS);
  if (hasta > limite) {
    return { ok: false, error: `Solo puedes purgar historial de hace más de ${RETENCION_MINIMA_DIAS} días (antes del ${limite.toLocaleDateString("es-CO")}).` };
  }
  try {
    const filas = await prisma.$queryRawUnsafe<{ purgar_auditoria: bigint }[]>(
      `SELECT saas.purgar_auditoria($1::timestamptz, $2::bigint) AS purgar_auditoria`,
      hasta, actorId,
    );
    return { ok: true, data: { filasBorradas: Number(filas[0].purgar_auditoria) } };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al purgar la auditoría.") };
  }
}
