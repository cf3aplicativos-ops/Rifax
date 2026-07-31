// Restablecimiento de contraseña mediado por administrador (sin correo).
import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Genera una contraseña temporal legible (10 caracteres, sin ambiguos).
function passwordTemporal(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return s;
}

// El usuario registra que olvidó su contraseña (respuesta genérica, no revela
// si el correo existe).
export async function registrarSolicitudReset(correo: string): Promise<Resultado> {
  const c = correo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { ok: false, error: "Ingresa un correo válido." };
  await prisma.$executeRawUnsafe(`INSERT INTO saas.reset_solicitudes (correo) VALUES ($1::citext)`, c);
  return { ok: true };
}

export interface SolicitudReset { id: string; correo: string; creadoEn: Date }
export async function listarSolicitudesReset(): Promise<SolicitudReset[]> {
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; correo: string; creado_en: Date }[]>(
    `SELECT id, correo, creado_en FROM saas.reset_solicitudes WHERE atendida = false ORDER BY creado_en DESC LIMIT 100`,
  );
  return filas.map((f) => ({ id: String(f.id), correo: f.correo, creadoEn: f.creado_en }));
}

// Super-admin: restablece por correo, ya sea un usuario de tenant o un
// super-admin de plataforma. Devuelve la contraseña temporal (mostrar una vez).
export async function restablecerPorCorreo(correo: string): Promise<Resultado<{ password: string; quien: string }>> {
  const c = correo.trim();
  if (!c) return { ok: false, error: "Indica el correo." };
  const nueva = passwordTemporal();
  const hash = await hashPassword(nueva);

  const usuario = await prisma.usuarios.findFirst({ where: { correo: c }, select: { id: true, nombre: true } });
  if (usuario) {
    await prisma.$transaction(async (tx) => {
      await tx.usuarios.update({ where: { id: usuario.id }, data: { password_hash: hash } });
      await tx.sesiones.updateMany({ where: { usuario_id: usuario.id, revocada: false }, data: { revocada: true } });
      await tx.$executeRawUnsafe(`UPDATE saas.reset_solicitudes SET atendida = true WHERE correo = $1::citext`, c);
    });
    return { ok: true, data: { password: nueva, quien: `${usuario.nombre} (usuario)` } };
  }

  const admin = await prisma.plataforma_admins.findUnique({ where: { correo: c }, select: { id: true, nombre: true } });
  if (admin) {
    await prisma.plataforma_admins.update({ where: { id: admin.id }, data: { password_hash: hash } });
    await prisma.$executeRawUnsafe(`UPDATE saas.reset_solicitudes SET atendida = true WHERE correo = $1::citext`, c);
    return { ok: true, data: { password: nueva, quien: `${admin.nombre} (super-admin)` } };
  }

  return { ok: false, error: "No existe un usuario con ese correo." };
}

// Admin del tenant: restablece la contraseña de uno de SUS usuarios.
export async function restablecerUsuarioTenant(tenantId: bigint, usuarioId: bigint): Promise<Resultado<{ password: string }>> {
  const u = await prisma.usuarios.findFirst({ where: { id: usuarioId, tenant_id: tenantId }, select: { id: true } });
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  const nueva = passwordTemporal();
  const hash = await hashPassword(nueva);
  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: u.id }, data: { password_hash: hash } });
    await tx.sesiones.updateMany({ where: { usuario_id: u.id, revocada: false }, data: { revocada: true } });
  });
  return { ok: true, data: { password: nueva } };
}
