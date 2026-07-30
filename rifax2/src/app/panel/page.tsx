import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requireSuper } from "@/lib/auth/rbac";
import { listarTenants } from "@/lib/superadmin";
import { moraPorTenant } from "@/lib/facturacion";
import { PLANES } from "@/lib/planes";
import { fechaHora, money } from "@/lib/format";
import { cambiarEstadoTenantAction, cambiarMaxSedesAction, cambiarPlanTenantAction } from "./actions";
import BorrarWizard from "./borrar-wizard";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  suspendido: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  inactivo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function PanelHome({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; estado?: string; sedes?: string; plan?: string; purgado?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const [tenants, mora] = await Promise.all([listarTenants(), moraPorTenant()]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle icon="empresas">Empresas (tenants)</PageTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {tenants.length} {tenants.length === 1 ? "empresa" : "empresas"} en la plataforma
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/panel/facturacion" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Facturación</Link>
          <Link href="/panel/carrusel" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Carrusel</Link>
          <Link href="/panel/nuevo" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">+ Nueva empresa</Link>
        </div>
      </div>

      {sp.creado ? <Aviso tipo="ok">Empresa creada con su administrador.</Aviso> : null}
      {sp.estado ? <Aviso tipo="ok">Estado actualizado.</Aviso> : null}
      {sp.sedes ? <Aviso tipo="ok">Número de sedes actualizado.</Aviso> : null}
      {sp.plan ? <Aviso tipo="ok">Plan actualizado.</Aviso> : null}
      {sp.purgado ? <Aviso tipo="ok">Empresa y todos sus datos eliminados.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {tenants.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no hay empresas. Crea la primera para empezar.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {tenants.map((t) => {
            const m = mora[t.id];
            const cap = PLANES[(t.plan as "basico" | "corporativo")] ?? PLANES.basico;
            const sobreUsuarios = cap.maxUsuarios != null && t.usuarios > cap.maxUsuarios;
            return (
              <div key={t.id} className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.nombre}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[t.estado] ?? estadoClase.inactivo}`}>{t.estado}</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Plan {cap.etiqueta}</span>
                      {m && m.pendiente > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Mora {money(m.pendiente)}{m.vencidas > 0 ? ` · ${m.vencidas} vencida${m.vencidas === 1 ? "" : "s"}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{t.slug}</span> · {t.sedes}/{t.max_sedes} sedes ·{" "}
                      <span className={sobreUsuarios ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                        {t.usuarios}{cap.maxUsuarios != null ? `/${cap.maxUsuarios}` : ""} usuario{t.usuarios === 1 ? "" : "s"}
                      </span>{" "}
                      · creada {fechaHora(t.creado_en)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  {/* Plan */}
                  <form action={cambiarPlanTenantAction} className="flex items-end gap-1">
                    <input type="hidden" name="tenant_id" value={t.id} />
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Plan</label>
                      <select name="plan" defaultValue={t.plan} className={ctrl}>
                        <option value="basico">Básico</option>
                        <option value="corporativo">Corporativo</option>
                      </select>
                    </div>
                    <button type="submit" className={btnSec}>Aplicar</button>
                  </form>

                  {/* Estado */}
                  <form action={cambiarEstadoTenantAction} className="flex items-end gap-1">
                    <input type="hidden" name="tenant_id" value={t.id} />
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Estado</label>
                      <select name="estado" defaultValue={t.estado} className={ctrl}>
                        <option value="activo">activo</option>
                        <option value="suspendido">suspendido (mora)</option>
                        <option value="inactivo">inactivo</option>
                      </select>
                    </div>
                    <button type="submit" className={btnSec}>Aplicar</button>
                  </form>

                  {/* Máx. sedes */}
                  <form action={cambiarMaxSedesAction} className="flex items-end gap-1">
                    <input type="hidden" name="tenant_id" value={t.id} />
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Sedes autorizadas</label>
                      <input name="max_sedes" type="number" min={t.sedes || 1} defaultValue={t.max_sedes} className={`${ctrl} w-24`} />
                    </div>
                    <button type="submit" className={btnSec}>Aplicar</button>
                  </form>

                  {/* Borrado en 3 pasos */}
                  <div className="ml-auto w-full sm:w-auto sm:flex-1">
                    <BorrarWizard tenantId={t.id} slug={t.slug} nombre={t.nombre} />
                  </div>
                </div>
              </div>
            );
          })}
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
