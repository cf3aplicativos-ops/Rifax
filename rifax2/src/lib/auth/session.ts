// Sesión del lado servidor (runtime Node) para el modelo multi-tenant.
//  - Super-admin de plataforma: JWT sin fila en BD (no pertenece a un tenant).
//  - Usuario de tenant: JWT + fila en `sesiones` (revocable) + contexto de
//    tenant/sede/permisos.
import "server-only";
import { cookies, headers } from "next/headers";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signSession, verifySession, SESSION_COOKIE } from "./jwt";

const TTL = 60 * 60 * 8; // 8 horas

export interface SuperAdmin {
  id: bigint;
  uuid: string;
  nombre: string;
  correo: string;
}

export interface TenantCtx {
  id: bigint;
  uuid: string;
  nombre: string;
  slug: string;
  estado: string;
  maxSedes: number;
}

export interface TenantUser {
  id: bigint;
  uuid: string;
  nombre: string;
  correo: string;
  rol: string;
  permisos: string[];
  tenant: TenantCtx;
  sede: { id: bigint; nombre: string } | null;
}

export type Sesion =
  | { kind: "super"; admin: SuperAdmin }
  | { kind: "user"; user: TenantUser };

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL,
  };
}

export async function createSuperSession(admin: { uuid: string }): Promise<void> {
  const token = await signSession({ sub: admin.uuid, kind: "super" }, TTL);
  (await cookies()).set(SESSION_COOKIE, token, cookieOpts());
}

export async function createUserSession(usuario: {
  id: bigint;
  uuid: string;
}): Promise<void> {
  const familia = randomUUID();
  const refreshHash = createHash("sha256").update(randomBytes(32).toString("hex")).digest("hex");
  const hdrs = await headers();
  const fwd = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd && /^[0-9a-fA-F:.]+$/.test(fwd) ? fwd : null;

  await prisma.sesiones.create({
    data: {
      usuario_id: usuario.id,
      refresh_token_hash: refreshHash,
      familia,
      ip,
      user_agent: hdrs.get("user-agent") ?? null,
      expira_en: new Date(Date.now() + TTL * 1000),
    },
  });

  const token = await signSession({ sub: usuario.uuid, kind: "user", sid: familia }, TTL);
  (await cookies()).set(SESSION_COOKIE, token, cookieOpts());
}

export async function getSession(): Promise<Sesion | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;

  if (claims.kind === "super") {
    const admin = await prisma.plataforma_admins.findUnique({ where: { uuid: claims.sub } });
    if (!admin || admin.estado !== "activo") return null;
    return {
      kind: "super",
      admin: { id: admin.id, uuid: admin.uuid, nombre: admin.nombre, correo: admin.correo },
    };
  }

  // Usuario de tenant
  if (!claims.sid) return null;
  const sesion = await prisma.sesiones.findFirst({
    where: { familia: claims.sid, revocada: false, expira_en: { gt: new Date() } },
    select: { id: true },
  });
  if (!sesion) return null;

  const u = await prisma.usuarios.findUnique({
    where: { uuid: claims.sub },
    include: {
      roles: { include: { roles_permisos: { include: { permisos: true } } } },
      tenants: true,
      sedes: { select: { id: true, nombre: true } },
    },
  });
  if (!u || u.estado !== "activo") return null;
  // Tenant suspendido/inactivo bloquea a todos sus usuarios.
  if (u.tenants.estado !== "activo") return null;

  return {
    kind: "user",
    user: {
      id: u.id,
      uuid: u.uuid,
      nombre: u.nombre,
      correo: u.correo,
      rol: u.roles.nombre,
      permisos: u.roles.roles_permisos.map((rp) => rp.permisos.codigo),
      tenant: {
        id: u.tenants.id,
        uuid: u.tenants.uuid,
        nombre: u.tenants.nombre,
        slug: u.tenants.slug,
        estado: u.tenants.estado,
        maxSedes: u.tenants.max_sedes,
      },
      sede: u.sedes ? { id: u.sedes.id, nombre: u.sedes.nombre } : null,
    },
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await verifySession(token);
    if (claims?.kind === "user" && claims.sid) {
      await prisma.sesiones.updateMany({ where: { familia: claims.sid }, data: { revocada: true } });
    }
  }
  jar.delete(SESSION_COOKIE);
}
