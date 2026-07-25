import Link from "next/link";
import { requireSuper } from "@/lib/auth/rbac";
import { listarTenants } from "@/lib/superadmin";
import { fechaHora } from "@/lib/format";
import { cambiarEstadoTenantAction, cambiarMaxSedesAction, purgarTenantAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  suspendido: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  inactivo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function PanelHome({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; estado?: string; sedes?: string; purgado?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const tenants = await listarTenants();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Empresas (tenants)</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {tenants.length} {tenants.length === 1 ? "empresa" : "empresas"} en la plataforma
          </p>
        </div>
        <Link
          href="/panel/nuevo"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          + Nueva empresa
        </Link>
      </div>

      {sp.creado ? <Aviso tipo="ok">Empresa creada con su administrador.</Aviso> : null}
      {sp.estado ? <Aviso tipo="ok">Estado actualizado.</Aviso> : null}
      {sp.sedes ? <Aviso tipo="ok">Número de sedes actualizado.</Aviso> : null}
      {sp.purgado ? <Aviso tipo="ok">Empresa y todos sus datos eliminados.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {tenants.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no hay empresas. Crea la primera para empezar.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {tenants.map((t) => (
            <div
              key={String(t.id)}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.nombre}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[t.estado] ?? estadoClase.inactivo}`}>
                      {t.estado}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-mono">{t.slug}</span> · {t._count.sedes}/{t.max_sedes} sedes ·{" "}
                    {t._count.usuarios} usuario{t._count.usuarios === 1 ? "" : "s"} · creada {fechaHora(t.creado_en)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                {/* Estado */}
                <form action={cambiarEstadoTenantAction} className="flex items-end gap-1">
                  <input type="hidden" name="tenant_id" value={String(t.id)} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Estado</label>
                    <select name="estado" defaultValue={t.estado} className={ctrl}>
                      <option value="activo">activo</option>
                      <option value="suspendido">suspendido</option>
                      <option value="inactivo">inactivo</option>
                    </select>
                  </div>
                  <button type="submit" className={btnSec}>Aplicar</button>
                </form>

                {/* Máx. sedes */}
                <form action={cambiarMaxSedesAction} className="flex items-end gap-1">
                  <input type="hidden" name="tenant_id" value={String(t.id)} />
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Sedes autorizadas</label>
                    <input name="max_sedes" type="number" min={t._count.sedes || 1} defaultValue={t.max_sedes} className={`${ctrl} w-24`} />
                  </div>
                  <button type="submit" className={btnSec}>Aplicar</button>
                </form>

                {/* Purga */}
                <details className="ml-auto">
                  <summary className="cursor-pointer list-none rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
                    Eliminar empresa
                  </summary>
                  <form action={purgarTenantAction} className="mt-2 flex items-end gap-1 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <input type="hidden" name="tenant_id" value={String(t.id)} />
                    <input type="hidden" name="slug" value={t.slug} />
                    <div>
                      <label className="mb-1 block text-xs text-red-700 dark:text-red-300">
                        Escribe <span className="font-mono font-bold">{t.slug}</span> para confirmar el borrado total
                      </label>
                      <input name="confirm" placeholder={t.slug} className={`${ctrl} w-40`} />
                    </div>
                    <button type="submit" className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700">
                      Borrar todo
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ctrl =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const btnSec =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase =
    tipo === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
