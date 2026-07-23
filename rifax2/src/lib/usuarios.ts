// Servicio de usuarios y roles.
// Toda mutación queda auditada. Incluye salvaguardas contra el auto-bloqueo:
// un usuario no puede desactivarse ni cambiarse el rol a sí mismo, para que
// nadie se deje fuera del sistema por accidente.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const ESTADOS = ["activo", "inactivo", "bloqueado"] as const;

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  correo: z.string().email("Correo inválido."),
  telefono: z.string().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  rol_id: z.coerce.bigint(),
});

export async function listarUsuarios() {
  return prisma.usuarios.findMany({
    orderBy: { id: "asc" },
    include: { roles: true },
  });
}

export async function listarRoles() {
  return prisma.roles.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { roles_permisos: true, usuarios: true } } },
  });
}

export async function crearUsuario(input: unknown, actorId: bigint | null): Promise<Resultado> {
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  const rol = await prisma.roles.findUnique({ where: { id: d.rol_id } });
  if (!rol) return { ok: false, error: "El rol indicado no existe." };

  const existente = await prisma.usuarios.findUnique({ where: { correo: d.correo } });
  if (existente) return { ok: false, error: "Ya existe un usuario con ese correo." };

  try {
    const hash = await hashPassword(d.password);
    await prisma.$transaction(async (tx) => {
      const creado = await tx.usuarios.create({
        data: {
          nombre: d.nombre,
          correo: d.correo,
          telefono: d.telefono || null,
          password_hash: hash,
          rol_id: d.rol_id,
          estado: "activo",
        },
      });
      await auditar(tx, {
        actorId,
        accion: "usuario.crear",
        entidadTipo: "usuario",
        entidadId: creado.id,
        despues: { correo: d.correo, nombre: d.nombre, rol: rol.nombre, estado: "activo" },
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el usuario." };
  }
}

export async function cambiarRol(
  usuarioId: bigint,
  rolId: bigint,
  actorId: bigint | null,
): Promise<Resultado> {
  if (actorId !== null && usuarioId === actorId) {
    return { ok: false, error: "No puedes cambiar tu propio rol." };
  }

  const [usuario, rol] = await Promise.all([
    prisma.usuarios.findUnique({ where: { id: usuarioId }, include: { roles: true } }),
    prisma.roles.findUnique({ where: { id: rolId } }),
  ]);
  if (!usuario) return { ok: false, error: "Usuario no encontrado." };
  if (!rol) return { ok: false, error: "Rol no encontrado." };
  if (usuario.rol_id === rolId) return { ok: true };

  // No dejar el sistema sin ningún administrador activo.
  if (usuario.roles.nombre === "admin" && rol.nombre !== "admin") {
    const admins = await contarAdminsActivos();
    if (admins <= 1) {
      return { ok: false, error: "Debe quedar al menos un administrador activo." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { rol_id: rolId } });
    await auditar(tx, {
      actorId,
      accion: "usuario.editar",
      entidadTipo: "usuario",
      entidadId: usuarioId,
      antes: { rol: usuario.roles.nombre },
      despues: { rol: rol.nombre },
    });
  });
  return { ok: true };
}

export async function cambiarEstado(
  usuarioId: bigint,
  estado: string,
  actorId: bigint | null,
): Promise<Resultado> {
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) {
    return { ok: false, error: "Estado inválido." };
  }
  if (actorId !== null && usuarioId === actorId && estado !== "activo") {
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  }

  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    include: { roles: true },
  });
  if (!usuario) return { ok: false, error: "Usuario no encontrado." };
  if (usuario.estado === estado) return { ok: true };

  if (usuario.roles.nombre === "admin" && estado !== "activo") {
    const admins = await contarAdminsActivos();
    if (admins <= 1) {
      return { ok: false, error: "Debe quedar al menos un administrador activo." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { estado } });
    // Al desactivar, se revocan sus sesiones abiertas.
    if (estado !== "activo") {
      await tx.sesiones.updateMany({
        where: { usuario_id: usuarioId, revocada: false },
        data: { revocada: true },
      });
    }
    await auditar(tx, {
      actorId,
      accion: "usuario.editar",
      entidadTipo: "usuario",
      entidadId: usuarioId,
      antes: { estado: usuario.estado },
      despues: { estado },
    });
  });
  return { ok: true };
}

/** Cambio de contraseña propia: exige la contraseña actual. */
export async function cambiarPasswordPropia(
  usuarioId: bigint,
  actual: string,
  nueva: string,
): Promise<Resultado> {
  if (nueva.length < 8) {
    return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (actual === nueva) {
    return { ok: false, error: "La nueva contraseña debe ser distinta de la actual." };
  }

  const usuario = await prisma.usuarios.findUnique({ where: { id: usuarioId } });
  if (!usuario) return { ok: false, error: "Usuario no encontrado." };

  const ok = await verifyPassword(actual, usuario.password_hash);
  if (!ok) return { ok: false, error: "La contraseña actual no es correcta." };

  const hash = await hashPassword(nueva);
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: usuarioId }, data: { password_hash: hash } });
    // Se revocan las demás sesiones: si alguien más la conocía, queda fuera.
    await tx.sesiones.updateMany({
      where: { usuario_id: usuarioId, revocada: false },
      data: { revocada: true },
    });
    await auditar(tx, {
      actorId: usuarioId,
      accion: "usuario.password",
      entidadTipo: "usuario",
      entidadId: usuarioId,
      despues: { cambio: "contraseña propia", sesiones: "revocadas" },
    });
  });
  return { ok: true };
}

async function contarAdminsActivos(): Promise<number> {
  return prisma.usuarios.count({
    where: { estado: "activo", roles: { nombre: "admin" } },
  });
}
