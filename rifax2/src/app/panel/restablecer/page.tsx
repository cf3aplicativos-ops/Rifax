import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requireSuper } from "@/lib/auth/rbac";
import { listarSolicitudesReset } from "@/lib/reset-password";
import { fechaHora } from "@/lib/format";
import { restablecerPorCorreoAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; pass?: string; quien?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const solicitudes = await listarSolicitudesReset();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a empresas</Link>
      <PageTitle icon="usuarios" className="mt-2">Restablecer contraseñas</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Genera una contraseña temporal para un usuario o super-admin que la olvidó.</p>

      {sp.ok && sp.pass ? (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Contraseña temporal para <strong>{sp.quien}</strong> (se muestra una sola vez):
          </p>
          <p className="mt-2 select-all rounded-lg bg-white px-3 py-2 text-center font-mono text-lg font-bold text-slate-900 dark:bg-slate-900 dark:text-white">{sp.pass}</p>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Entrégala a la persona y pídele que la cambie al ingresar. Sus sesiones activas se cerraron.</p>
        </div>
      ) : null}
      {sp.error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p> : null}

      {/* Restablecer por correo */}
      <form action={restablecerPorCorreoAction} className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <label htmlFor="correo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo del usuario</label>
        <div className="flex gap-2">
          <input id="correo" name="correo" type="email" required placeholder="correo@empresa.co" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Restablecer</button>
        </div>
      </form>

      {/* Solicitudes pendientes */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Solicitudes pendientes ({solicitudes.length})</h2>
        {solicitudes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No hay solicitudes pendientes.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 dark:divide-slate-800 dark:border-slate-700">
            {solicitudes.map((s) => (
              <form key={s.id} action={restablecerPorCorreoAction} className="flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{s.correo}</p>
                  <p className="text-xs text-slate-400">{fechaHora(s.creadoEn)}</p>
                </div>
                <input type="hidden" name="correo" value={s.correo} />
                <button type="submit" className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300">Restablecer</button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
