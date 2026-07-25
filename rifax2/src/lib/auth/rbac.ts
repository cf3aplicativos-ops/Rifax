// Guardas de autorización para el modelo multi-tenant.
import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SuperAdmin, type TenantUser } from "./session";

export type { SuperAdmin, TenantUser };

/** Exige sesión de super-admin de plataforma; si no, va a /login. */
export async function requireSuper(): Promise<SuperAdmin> {
  const s = await getSession();
  if (!s || s.kind !== "super") redirect("/login");
  return (s as { kind: "super"; admin: SuperAdmin }).admin;
}

/** Exige sesión de usuario de tenant; si no, va a /login. */
export async function requireUser(): Promise<TenantUser> {
  const s = await getSession();
  if (!s || s.kind !== "user") redirect("/login");
  return (s as { kind: "user"; user: TenantUser }).user;
}

/** Exige un permiso concreto dentro del tenant. */
export async function requirePermission(codigo: string): Promise<TenantUser> {
  const user = await requireUser();
  if (!user.permisos.includes(codigo)) {
    redirect(`/app?denied=${encodeURIComponent(codigo)}`);
  }
  return user;
}

export function hasPermission(user: TenantUser, codigo: string): boolean {
  return user.permisos.includes(codigo);
}
