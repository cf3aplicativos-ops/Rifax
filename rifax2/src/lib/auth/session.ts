// Gestión de sesión del lado servidor (runtime Node).
// - createSession: registra una fila en `sesiones` (revocable) y emite el JWT
//   en cookie httpOnly.
// - getSession: valida el JWT + la fila de sesión y carga usuario/rol/permisos.
// - destroySession: revoca la sesión y borra la cookie.
import "server-only";
import { cookies, headers } from "next/headers";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signSession, verifySession, SESSION_COOKIE } from "./jwt";

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

export interface CurrentUser {
  id: bigint;
  uuid: string;
  nombre: string;
  correo: string;
  rol: string;
  permisos: string[];
}

export async function createSession(usuario: {
  id: bigint;
  uuid: string;
  rolNombre: string;
}): Promise<void> {
  const familia = randomUUID();
  const refreshHash = createHash("sha256")
    .update(randomBytes(32).toString("hex"))
    .digest("hex");
  const expira = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const hdrs = await headers();
  const fwd = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
  // Solo guardamos IP si parece una dirección válida (columna INET).
  const ip = fwd && /^[0-9a-fA-F:.]+$/.test(fwd) ? fwd : null;
  const ua = hdrs.get("user-agent") ?? null;

  await prisma.sesiones.create({
    data: {
      usuario_id: usuario.id,
      refresh_token_hash: refreshHash,
      familia,
      ip,
      user_agent: ua,
      expira_en: expira,
    },
  });

  const token = await signSession(
    { sub: usuario.uuid, sid: familia, rol: usuario.rolNombre },
    SESSION_TTL_SECONDS,
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySession(token);
  if (!claims) return null;

  // La sesión debe existir, no estar revocada ni vencida.
  const sesion = await prisma.sesiones.findFirst({
    where: { familia: claims.sid, revocada: false, expira_en: { gt: new Date() } },
    select: { id: true },
  });
  if (!sesion) return null;

  const usuario = await prisma.usuarios.findUnique({
    where: { uuid: claims.sub },
    include: {
      roles: { include: { roles_permisos: { include: { permisos: true } } } },
    },
  });
  if (!usuario || usuario.estado !== "activo") return null;

  return {
    id: usuario.id,
    uuid: usuario.uuid,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.roles.nombre,
    permisos: usuario.roles.roles_permisos.map((rp) => rp.permisos.codigo),
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await verifySession(token);
    if (claims?.sid) {
      await prisma.sesiones.updateMany({
        where: { familia: claims.sid },
        data: { revocada: true },
      });
    }
  }
  jar.delete(SESSION_COOKIE);
}
