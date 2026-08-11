import Link from "next/link";
import { requireSuper } from "@/lib/auth/rbac";
import { proximosVencimientosCriticos } from "@/lib/vencimientos";
import { logoutSuperAction } from "./actions";
import VencimientoAvisoSuper from "./vencimiento-aviso";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuper();
  const criticos = await proximosVencimientosCriticos(5);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <VencimientoAvisoSuper items={criticos} />
      <header className="border-b border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              R
            </div>
            <div>
              <Link href="/panel" className="text-sm font-bold text-slate-900 dark:text-white">
                RIFAX <span className="text-indigo-600">Plataforma</span>
              </Link>
              <p className="text-[11px] leading-none text-slate-400">Consola de super-administración</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/manual/manual-usuario.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm text-slate-500 hover:text-slate-700 sm:inline dark:text-slate-400 dark:hover:text-slate-200"
            >
              Manual de usuario
            </a>
            <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300">
              {admin.nombre}
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              super-admin
            </span>
            <form action={logoutSuperAction}>
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
