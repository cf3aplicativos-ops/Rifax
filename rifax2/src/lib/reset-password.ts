// Restablecimiento de contraseña en dos pasos: solicitar (genera un token de
// un solo uso y lo envía por correo como enlace) y confirmar (el enlace
// consume el token y ahí sí cambia la contraseña). Antes, una sola petición
// ya cambiaba la contraseña del titular en el acto — mitigado solo por
// rate-limit, nunca eliminado (hallazgo de seguridad del 2026-08-04). Con el
// token, quien no tiene acceso al correo del titular no puede completar el
// cambio, sin importar cuántas veces pida el reset.
import "server-only";
import { randomInt, randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendMail, mailPasswordTemporal, mailEnlaceReset } from "@/lib/mail";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

// Genera una contraseña temporal legible (10 caracteres, sin ambiguos).
function passwordTemporal(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return s;
}

function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// El usuario solicita recuperar su contraseña: se valida contra el correo
// registrado y, si corresponde a un usuario o super-admin real, se genera un
// token de un solo uso y se envía por correo un enlace para confirmarlo — la
// contraseña todavía NO cambia aquí. La respuesta es siempre genérica para no
// revelar si el correo existe. `origen` es el `https://host` desde donde se
// arma el enlace (lo resuelve el caller con `headers()`, ver actions.ts).
//
// `data.token` solo lo usan las pruebas (test/functional/index.test.ts) para
// completar el flujo sin depender de leer el correo real — la Server Action
// pública (`solicitarResetAction`) descarta `data` por completo.
export async function solicitarResetAutomatico(correo: string, origen: string): Promise<Resultado<{ token: string }>> {
  const c = correo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { ok: false, error: "Ingresa un correo válido." };

  // Queda registrada como atendida: se resuelve en el acto (ya no requiere
  // revisión manual), el panel de super-admin sigue disponible como respaldo.
  await prisma.$executeRawUnsafe(`INSERT INTO saas.reset_solicitudes (correo, atendida) VALUES ($1::citext, true)`, c);

  const existe =
    (await prisma.usuarios.findFirst({ where: { correo: c }, select: { id: true } })) ??
    (await prisma.plataforma_admins.findFirst({ where: { correo: c }, select: { id: true } }));
  if (!existe) return { ok: true };

  const token = generarToken();
  await prisma.reset_tokens.create({
    data: { correo: c, token_hash: hashToken(token), expira_en: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  try {
    await sendMail({ to: c, ...mailEnlaceReset({ enlace: `${origen}/login/restablecer/${token}` }) });
  } catch (e) {
    // El token ya quedó guardado; un fallo de envío no debe impedir que quien
    // sí reciba el correo (reintentando) pueda completar el flujo.
    console.error("[reset-password] fallo al enviar el correo:", e instanceof Error ? e.message : e);
  }
  return { ok: true, data: { token } };
}

// Confirma el enlace: valida el token (existe, no usado, no expirado), lo
// consume, y AHÍ SÍ genera y aplica la contraseña temporal — mismo efecto que
// antes tenía `solicitarResetAutomatico` de una sola vez, ahora repartido en
// dos pasos con una prueba real de acceso al correo en medio.
export async function confirmarReset(token: string): Promise<Resultado<{ password: string; nombre: string }>> {
  const hash = hashToken(token);
  const fila = await prisma.reset_tokens.findUnique({ where: { token_hash: hash } });
  if (!fila || fila.usado || fila.expira_en < new Date()) {
    return { ok: false, error: "Este enlace ya no es válido. Solicita un nuevo restablecimiento." };
  }

  const nueva = passwordTemporal();
  const hashPass = await hashPassword(nueva);

  const resultado = await prisma.$transaction(async (tx) => {
    // Vuelve a exigir "no usado" dentro de la transacción: si dos peticiones
    // llegaran a la vez con el mismo token, solo una debe poder consumirlo.
    const consumida = await tx.reset_tokens.updateMany({
      where: { id: fila.id, usado: false },
      data: { usado: true },
    });
    if (consumida.count === 0) return null;

    const usuario = await tx.usuarios.findFirst({ where: { correo: fila.correo }, select: { id: true, nombre: true } });
    if (usuario) {
      await tx.usuarios.update({ where: { id: usuario.id }, data: { password_hash: hashPass } });
      await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, usuario.id);
      await tx.sesiones.updateMany({ where: { usuario_id: usuario.id, revocada: false }, data: { revocada: true } });
      return { nombre: usuario.nombre };
    }

    const admin = await tx.plataforma_admins.findUnique({ where: { correo: fila.correo }, select: { id: true, nombre: true } });
    if (admin) {
      await tx.plataforma_admins.update({ where: { id: admin.id }, data: { password_hash: hashPass } });
      return { nombre: admin.nombre };
    }
    return null;
  });

  if (!resultado) return { ok: false, error: "Este enlace ya no es válido. Solicita un nuevo restablecimiento." };

  try {
    await sendMail({ to: fila.correo, ...mailPasswordTemporal({ nombre: resultado.nombre, password: nueva }) });
  } catch (e) {
    console.error("[reset-password] fallo al enviar el correo:", e instanceof Error ? e.message : e);
  }
  return { ok: true, data: { password: nueva, nombre: resultado.nombre } };
}

// Admin del tenant: restablece la contraseña de uno de SUS usuarios. A
// diferencia de "olvidé mi contraseña" (self-service, sin autenticar), aquí
// quien actúa ya inició sesión y tiene el permiso correspondiente — no
// necesita el token de confirmación, el cambio inmediato es correcto.
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
