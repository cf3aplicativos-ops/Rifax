// Helpers de autorización (RBAC) para server components y server actions.
import "server-only";
import { redirect } from "next/navigation";
import { getSession, type CurrentUser } from "./session";

export type { CurrentUser };

/** Exige sesión válida; si no, redirige a /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Exige un permiso concreto; si no lo tiene, vuelve al panel con aviso. */
export async function requirePermission(codigo: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permisos.includes(codigo)) {
    redirect(`/admin?denied=${encodeURIComponent(codigo)}`);
  }
  return user;
}

export function hasPermission(user: CurrentUser, codigo: string): boolean {
  return user.permisos.includes(codigo);
}
