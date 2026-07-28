import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { logoutUserAction } from "@/app/app/actions";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Solo para rol vendedor; otros roles usan el panel /app.
  if (user.rol !== "vendedor") redirect("/app");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">R</div>
            <div>
              <p className="text-sm font-bold leading-none text-slate-900 dark:text-white">Vendedor</p>
              <p className="text-[11px] leading-none text-slate-400">{user.tenant.nombre}</p>
            </div>
          </div>
          <form action={logoutUserAction}>
            <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
