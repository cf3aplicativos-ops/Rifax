import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { logoutAction } from "./actions";

// Cada sección declara el permiso que exige; el nav solo muestra aquellas a las
// que el usuario realmente puede entrar (coherente con requirePermission).
const nav = [
  { href: "/admin", label: "Resumen", permiso: null },
  { href: "/admin/rifas", label: "Rifas", permiso: "rifa.ver" },
  { href: "/admin/ventas", label: "Ventas", permiso: "venta.ver" },
  { href: "/admin/cartera", label: "Cartera", permiso: "cartera.ver" },
  { href: "/admin/vendedores", label: "Vendedores", permiso: "vendedor.ver" },
  { href: "/admin/usuarios", label: "Usuarios", permiso: "usuario.ver" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              RIFAX <span className="text-red-600">2</span>
            </Link>
            <nav className="hidden gap-4 sm:flex">
              {nav
                .filter((n) => n.permiso === null || user.permisos.includes(n.permiso))
                .map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-sm text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/perfil" className="text-right transition hover:opacity-70">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user.nombre}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.rol}</p>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
