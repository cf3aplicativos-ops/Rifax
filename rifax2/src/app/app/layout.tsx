import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { logoutUserAction } from "./actions";

const nav = [
  { href: "/app", label: "Inicio", permiso: null },
  { href: "/app/rifas", label: "Rifas", permiso: "rifa.ver" },
  { href: "/app/ventas", label: "Ventas", permiso: "venta.ver" },
  { href: "/app/cartera", label: "Cartera", permiso: "cartera.ver" },
  { href: "/app/vendedores", label: "Vendedores", permiso: "vendedor.ver" },
  { href: "/app/usuarios", label: "Usuarios", permiso: "usuario.ver" },
  { href: "/app/sedes", label: "Sedes", permiso: "sede.ver" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                {user.tenant.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold leading-none text-slate-900 dark:text-white">
                  {user.tenant.nombre}
                </p>
                <p className="text-[11px] leading-none text-slate-400">
                  {user.sede ? `Sede: ${user.sede.nombre}` : "Todas las sedes"}
                </p>
              </div>
            </Link>
            <nav className="hidden gap-4 sm:flex">
              {nav
                .filter((n) => n.permiso === null || user.permisos.includes(n.permiso))
                .map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app/perfil" className="text-right transition hover:opacity-70">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.rol}</p>
            </Link>
            <form action={logoutUserAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
