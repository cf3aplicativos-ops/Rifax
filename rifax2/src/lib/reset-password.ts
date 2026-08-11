// Restablecimiento de contraseña: automático por correo (ver
// `solicitarResetAutomatico`), que reutiliza la misma lógica de generación
// que antes exponía el panel manual del super-admin (ya retirado).
import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendMail, mailPasswordTemporal } from "@/lib/mail";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Genera una contraseña temporal legible (10 caracteres, sin ambiguos).
function passwordTemporal(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return s;
}

// El usuario solicita recuperar su contraseña: se valida contra el correo
// registrado y, si corresponde a un usuario o super-admin real, se genera y
// envía de inmediato una contraseña temporal a ese correo (self-service, sin
// esperar a que un administrador la procese). La respuesta es siempre
// genérica para no revelar si el correo existe.
export async function solicitarResetAutomatico(correo: string): Promise<Resultado> {
  const c = correo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { ok: false, error: "Ingresa un correo válido." };

  // Queda registrada como atendida: se resuelve en el acto, no requiere
  // revisión manual (el panel de super-admin sigue disponible como respaldo).
  await prisma.$executeRawUnsafe(`INSERT INTO saas.reset_solicitudes (correo, atendida) VALUES ($1::citext, true)`, c);

  const res = await restablecerPorCorreo(c);
  if (res.ok) {
    // La contraseña ya cambió y las sesiones ya se revocaron (commit hecho en
    // restablecerPorCorreo); un fallo de envío (SMTP caído, credenciales,
    // Gmail lo rechaza) no debe reventar la función ni la respuesta genérica
    // — solo queda sin recibir el correo, y puede volver a solicitarlo.
    try {
      await sendMail({ to: c, ...mailPasswordTemporal({ nombre: res.data!.nombre, password: res.data!.password }) });
    } catch (e) {
      console.error("[reset-password] fallo al enviar el correo:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true };
}

// Restablece por correo, ya sea un usuario de tenant o un super-admin de
// plataforma. Usada internamente por `solicitarResetAutomatico`.
async function restablecerPorCorreo(correo: string): Promise<Resultado<{ password: string; quien: string; nombre: string }>> {
  const c = correo.trim();
  if (!c) return { ok: false, error: "Indica el correo." };
  const nueva = passwordTemporal();
  const hash = await hashPassword(nueva);

  const usuario = await prisma.usuarios.findFirst({ where: { correo: c }, select: { id: true, nombre: true } });
  if (usuario) {
    await prisma.$transaction(async (tx) => {
      await tx.usuarios.update({ where: { id: usuario.id }, data: { password_hash: hash } });
      // Debe cambiar la contraseña temporal en el próximo ingreso.
      await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, usuario.id);
      await tx.sesiones.updateMany({ where: { usuario_id: usuario.id, revocada: false }, data: { revocada: true } });
      await tx.$executeRawUnsafe(`UPDATE saas.reset_solicitudes SET atendida = true WHERE correo = $1::citext`, c);
    });
    return { ok: true, data: { password: nueva, quien: `${usuario.nombre} (usuario)`, nombre: usuario.nombre } };
  }

  const admin = await prisma.plataforma_admins.findUnique({ where: { correo: c }, select: { id: true, nombre: true } });
  if (admin) {
    await prisma.plataforma_admins.update({ where: { id: admin.id }, data: { password_hash: hash } });
    await prisma.$executeRawUnsafe(`UPDATE saas.reset_solicitudes SET atendida = true WHERE correo = $1::citext`, c);
    return { ok: true, data: { password: nueva, quien: `${admin.nombre} (super-admin)`, nombre: admin.nombre } };
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
    await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, u.id);
    await tx.sesiones.updateMany({ where: { usuario_id: u.id, revocada: false }, data: { revocada: true } });
  });
  return { ok: true, data: { password: nueva } };
}
