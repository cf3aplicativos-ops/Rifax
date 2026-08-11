// Gestión de usuarios DENTRO de un tenant. El admin del tenant crea su personal
// y les asigna rol y (opcional) sede. Salvaguardas: no auto-bloqueo, y siempre
// debe quedar al menos un admin activo por tenant.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { capacidades } from "@/lib/planes";
import { mensajeError } from "@/lib/errores";
import { sendMail, mailPasswordCambiada } from "@/lib/mail";

type Resultado = { ok: true } | { ok: false; error: string };
const ESTADOS = ["activo", "inactivo", "bloqueado"] as const;

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  correo: z.string().email("Correo inválido."),
  telefono: z.string().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  rol_id: z.coerce.bigint(),
  sede_id: z.coerce.bigint().optional(),
  permisos: z.array(z.coerce.bigint()).optional(), // override del rol (opcional)
});

export async function listarUsuarios(tenantId: bigint) {
  return prisma.usuarios.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "asc" },
    include: { roles: true, sedes: { select: { nombre: true } } },
  });
}

// Usuario + sus permisos personalizados actuales (si tiene), para precargar
// el formulario de edición con el estado efectivo real (igual criterio que
// usa la sesión: si hay overrides, esos mandan; si no, los del rol).
export async function obtenerUsuario(tenantId: bigint, id: bigint) {
  const u = await prisma.usuarios.findFirst({
    where: { id, tenant_id: tenantId },
    include: { roles: true, sedes: { select: { id: true, nombre: true } } },
  });
  if (!u) return null;
  // `usuario_permisos` no está en el schema de Prisma (tabla agregada por SQL-first).
  const overrides = await prisma.$queryRawUnsafe<{ permiso_id: bigint }[]>(
    `SELECT permiso_id FROM saas.usuario_permisos WHERE usuario_id = $1::bigint`, id,
  );
  return { ...u, permisosPersonalizados: overrides.length > 0 ? overrides.map((o) => String(o.permiso_id)) : null };
}

export async function listarRoles() {
  return prisma.roles.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { roles_permisos: true } }, roles_permisos: { select: { permiso_id: true } } },
  });
}

// Catálogo de permisos + permisos por rol (para el editor de permisos por usuario).
export async function permisosYRoles() {
  const [permisos, roles] = await Promise.all([
    prisma.permisos.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true } }),
    prisma.roles.findMany({ orderBy: { id: "asc" }, include: { roles_permisos: { select: { permiso_id: true } } } }),
  ]);
  return {
    permisos: permisos.map((p) => ({ id: String(p.id), codigo: p.codigo })),
    roles: roles.map((r) => ({ id: String(r.id), nombre: r.nombre, descripcion: r.descripcion, permisos: r.roles_permisos.map((rp) => String(rp.permiso_id)) })),
  };
}

export async function crearUsuario(input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const rol = await prisma.roles.findUnique({ where: { id: d.rol_id } });
  if (!rol) return { ok: false, error: "El rol indicado no existe." };
  const dup = await prisma.usuarios.findFirst({ where: { tenant_id: tenantId, correo: d.correo } });
  if (dup) return { ok: false, error: "Ya existe un usuario con ese correo en tu empresa." };

  // Límite de usuarios: ilimitado, cap explícito del tenant, o el del plan.
  const tFilas = await prisma.$queryRawUnsafe<{ plan: string; usuarios_ilimitados: boolean; max_usuarios: number | null }[]>(
    `SELECT plan, usuarios_ilimitados, max_usuarios FROM saas.tenants WHERE id=$1::bigint`, tenantId,
  );
  const tf = tFilas[0];
  if (tf && !tf.usuarios_ilimitados) {
    const cap = capacidades(tf.plan);
    const limite = tf.max_usuarios != null ? tf.max_usuarios : cap.maxUsuarios;
    if (limite != null) {
      const actuales = await prisma.usuarios.count({ where: { tenant_id: tenantId } });
      if (actuales >= limite) {
        return { ok: false, error: `Se alcanzó el límite de ${limite} usuario(s) para esta empresa. Amplíalo desde el super-admin.` };
      }
    }
  }

  if (d.sede_id) {
    const sede = await prisma.sedes.findFirst({ where: { id: d.sede_id, tenant_id: tenantId } });
    if (!sede) return { ok: false, error: "Sede inválida." };
  }

  try {
    const hash = await hashPassword(d.password);
    await prisma.$transaction(async (tx) => {
      const u = await tx.usuarios.create({
        data: {
          tenant_id: tenantId,
          sede_id: d.sede_id ?? null,
          nombre: d.nombre,
          correo: d.correo,
          telefono: d.telefono || null,
          password_hash: hash,
          rol_id: d.rol_id,
          estado: "activo",
        },
      });
      // Obliga a definir contraseña propia en el primer ingreso.
      await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, u.id);
      // Permisos personalizados (override del rol), si se indicaron.
      if (d.permisos && d.permisos.length > 0) {
        // Los ids van como parámetro (arreglo), nunca interpolados en el SQL.
        await tx.$executeRawUnsafe(
          `INSERT INTO saas.usuario_permisos (usuario_id, permiso_id)
           SELECT $1::bigint, p FROM unnest($2::bigint[]) AS p ON CONFLICT DO NOTHING`,
          u.id, d.permisos,
        );
      }
      await auditar(tx, { tenantId, actorId, accion: "usuario.crear", entidadTipo: "usuario", entidadId: u.id, despues: { correo: d.correo, rol: rol.nombre, permisos_custom: d.permisos?.length ?? 0 } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al crear el usuario.") };
  }
}

async function adminsActivos(tenantId: bigint): Promise<number> {
  return prisma.usuarios.count({ where: { tenant_id: tenantId, estado: "activo", roles: { nombre: "admin" } } });
}

export async function cambiarRol(usuarioId: bigint, rolId: bigint, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  if (usuarioId === actorId) return { ok: false, error: "No puedes cambiar tu propio rol." };
  const [u, rol] = await Promise.all([
    prisma.usuarios.findFirst({ where: { id: usuarioId, tenant_id: tenantId }, include: { roles: true } }),
    prisma.roles.findUnique({ where: { id: rolId } }),
  ]);
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (!rol) return { ok: false, error: "Rol no encontrado." };
  if (u.rol_id === rolId) return { ok: true };
  if (u.roles.nombre === "admin" && rol.nombre !== "admin" && (await adminsActivos(tenantId)) <= 1) {
    return { ok: false, error: "Debe quedar al menos un administrador activo." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { rol_id: rolId } });
    await auditar(tx, { tenantId, actorId, accion: "usuario.editar", entidadTipo: "usuario", entidadId: usuarioId, antes: { rol: u.roles.nombre }, despues: { rol: rol.nombre } });
  });
  return { ok: true };
}

export async function cambiarEstado(usuarioId: bigint, estado: string, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) return { ok: false, error: "Estado inválido." };
  if (usuarioId === actorId && estado !== "activo") return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  const u = await prisma.usuarios.findFirst({ where: { id: usuarioId, tenant_id: tenantId }, include: { roles: true } });
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (u.estado === estado) return { ok: true };
  if (u.roles.nombre === "admin" && estado !== "activo" && (await adminsActivos(tenantId)) <= 1) {
    return { ok: false, error: "Debe quedar al menos un administrador activo." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { estado } });
    if (estado !== "activo") {
      await tx.sesiones.updateMany({ where: { usuario_id: usuarioId, revocada: false }, data: { revocada: true } });
    }
    await auditar(tx, { tenantId, actorId, accion: "usuario.editar", entidadTipo: "usuario", entidadId: usuarioId, antes: { estado: u.estado }, despues: { estado } });
  });
  return { ok: true };
}

// Edición general de un usuario interno: datos, rol, sede y permisos
// personalizados, todo en un solo guardado.
export const editarUsuarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  correo: z.string().email("Correo inválido."),
  telefono: z.string().optional(),
  rol_id: z.coerce.bigint(),
  sede_id: z.coerce.bigint().optional(),
  permisos: z.array(z.coerce.bigint()).optional(), // override del rol (opcional); vacío = usar los del rol
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").optional(), // solo si se quiere cambiar
});

export async function editarUsuario(usuarioId: bigint, input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const actual = await prisma.usuarios.findFirst({ where: { id: usuarioId, tenant_id: tenantId }, include: { roles: true } });
  if (!actual) return { ok: false, error: "Usuario no encontrado." };

  if (usuarioId === actorId && d.rol_id !== actual.rol_id) {
    return { ok: false, error: "No puedes cambiar tu propio rol." };
  }

  const rol = await prisma.roles.findUnique({ where: { id: d.rol_id } });
  if (!rol) return { ok: false, error: "El rol indicado no existe." };

  if (d.correo !== actual.correo) {
    const dup = await prisma.usuarios.findFirst({ where: { tenant_id: tenantId, correo: d.correo, NOT: { id: usuarioId } } });
    if (dup) return { ok: false, error: "Ya existe otro usuario con ese correo en tu empresa." };
  }

  if (d.sede_id) {
    const sede = await prisma.sedes.findFirst({ where: { id: d.sede_id, tenant_id: tenantId } });
    if (!sede) return { ok: false, error: "Sede inválida." };
  }

  if (actual.rol_id !== d.rol_id && actual.roles.nombre === "admin" && rol.nombre !== "admin" && (await adminsActivos(tenantId)) <= 1) {
    return { ok: false, error: "Debe quedar al menos un administrador activo." };
  }

  try {
    const passwordHash = d.password ? await hashPassword(d.password) : null;
    await prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: usuarioId },
        data: {
          nombre: d.nombre,
          correo: d.correo,
          telefono: d.telefono || null,
          rol_id: d.rol_id,
          sede_id: d.sede_id ?? null,
          ...(passwordHash ? { password_hash: passwordHash } : {}),
        },
      });
      if (passwordHash) {
        // Contraseña fijada por el admin: obliga a confirmarla/cambiarla en
        // el próximo ingreso y cierra las sesiones activas (mismo criterio
        // que restablecerUsuarioTenant).
        await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, usuarioId);
        await tx.sesiones.updateMany({ where: { usuario_id: usuarioId, revocada: false }, data: { revocada: true } });
      }
      // Reemplaza por completo los permisos personalizados por los indicados.
      // Nadie edita los suyos propios: sería una vía para auto-concederse
      // permisos, igual que ya se impide cambiarse el propio rol. Al editarse
      // a sí mismo se conservan los que ya tenía.
      if (usuarioId !== actorId) {
        await tx.$executeRawUnsafe(`DELETE FROM saas.usuario_permisos WHERE usuario_id = $1::bigint`, usuarioId);
        if (d.permisos && d.permisos.length > 0) {
          // Los ids van como parámetro (arreglo), nunca interpolados en el SQL.
          await tx.$executeRawUnsafe(
            `INSERT INTO saas.usuario_permisos (usuario_id, permiso_id)
             SELECT $1::bigint, p FROM unnest($2::bigint[]) AS p ON CONFLICT DO NOTHING`,
            usuarioId, d.permisos,
          );
        }
      }
      await auditar(tx, {
        tenantId, actorId, accion: "usuario.editar", entidadTipo: "usuario", entidadId: usuarioId,
        antes: { nombre: actual.nombre, correo: actual.correo, rol: actual.roles.nombre },
        despues: { nombre: d.nombre, correo: d.correo, rol: rol.nombre, permisos_custom: d.permisos?.length ?? 0, password_cambiada: Boolean(passwordHash) },
      });
    });
    if (passwordHash) {
      // Igual que en el "olvidé mi contraseña" self-service: la clave se
      // envía al correo de la cuenta, nunca se muestra en pantalla. Un fallo
      // de SMTP no debe revertir el cambio ya guardado, solo queda sin avisar.
      try {
        await sendMail({ to: d.correo, ...mailPasswordCambiada({ nombre: d.nombre, password: d.password! }) });
      } catch (e) {
        console.error("[usuarios] fallo al enviar el correo de contraseña actualizada:", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar el usuario.") };
  }
}

export async function cambiarPasswordPropia(usuarioId: bigint, tenantId: bigint, actual: string, nueva: string): Promise<Resultado> {
  if (nueva.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (actual === nueva) return { ok: false, error: "La nueva contraseña debe ser distinta de la actual." };
  const u = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (!(await verifyPassword(actual, u.password_hash))) return { ok: false, error: "La contraseña actual no es correcta." };
  const hash = await hashPassword(nueva);
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { password_hash: hash } });
    // Al cambiar la contraseña se levanta la obligación de cambiar la temporal.
    await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = false WHERE id = $1::bigint`, usuarioId);
    await tx.sesiones.updateMany({ where: { usuario_id: usuarioId, revocada: false }, data: { revocada: true } });
    await auditar(tx, { tenantId, actorId: usuarioId, accion: "usuario.password", entidadTipo: "usuario", entidadId: usuarioId, despues: { cambio: "contraseña propia" } });
  });
  return { ok: true };
}
