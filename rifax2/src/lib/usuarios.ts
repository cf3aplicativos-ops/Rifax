// Gestión de usuarios DENTRO de un tenant. El admin del tenant crea su personal
// y les asigna rol y (opcional) sede. Salvaguardas: no auto-bloqueo, y siempre
// debe quedar al menos un admin activo por tenant.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { capacidades } from "@/lib/planes";

type Resultado = { ok: true } | { ok: false; error: string };
const ESTADOS = ["activo", "inactivo", "bloqueado"] as const;

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  correo: z.string().email("Correo inválido."),
  telefono: z.string().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  rol_id: z.coerce.bigint(),
  sede_id: z.coerce.bigint().optional(),
});

export async function listarUsuarios(tenantId: bigint) {
  return prisma.usuarios.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "asc" },
    include: { roles: true, sedes: { select: { nombre: true } } },
  });
}

export async function listarRoles() {
  return prisma.roles.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { roles_permisos: true } } },
  });
}

export async function crearUsuario(input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const rol = await prisma.roles.findUnique({ where: { id: d.rol_id } });
  if (!rol) return { ok: false, error: "El rol indicado no existe." };
  const dup = await prisma.usuarios.findFirst({ where: { tenant_id: tenantId, correo: d.correo } });
  if (dup) return { ok: false, error: "Ya existe un usuario con ese correo en tu empresa." };

  // Límite de usuarios según el plan del tenant.
  const planFilas = await prisma.$queryRawUnsafe<{ plan: string }[]>(`SELECT plan FROM saas.tenants WHERE id=$1::bigint`, tenantId);
  const cap = capacidades(planFilas[0]?.plan);
  if (cap.maxUsuarios != null) {
    const actuales = await prisma.usuarios.count({ where: { tenant_id: tenantId } });
    if (actuales >= cap.maxUsuarios) {
      return { ok: false, error: `Tu plan ${cap.etiqueta} permite hasta ${cap.maxUsuarios} usuarios. Cambia a Corporativo para agregar más.` };
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
      await auditar(tx, { tenantId, actorId, accion: "usuario.crear", entidadTipo: "usuario", entidadId: u.id, despues: { correo: d.correo, rol: rol.nombre } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el usuario." };
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

export async function cambiarPasswordPropia(usuarioId: bigint, tenantId: bigint, actual: string, nueva: string): Promise<Resultado> {
  if (nueva.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (actual === nueva) return { ok: false, error: "La nueva contraseña debe ser distinta de la actual." };
  const u = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (!(await verifyPassword(actual, u.password_hash))) return { ok: false, error: "La contraseña actual no es correcta." };
  const hash = await hashPassword(nueva);
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { password_hash: hash } });
    await tx.sesiones.updateMany({ where: { usuario_id: usuarioId, revocada: false }, data: { revocada: true } });
    await auditar(tx, { tenantId, actorId: usuarioId, accion: "usuario.password", entidadTipo: "usuario", entidadId: usuarioId, despues: { cambio: "contraseña propia" } });
  });
  return { ok: true };
}
