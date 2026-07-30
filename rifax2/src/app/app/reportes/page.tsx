import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { PageTitle } from "@/components/icons";
import { resumenVentas, avancePorRifa, verificarAuditoria } from "@/lib/reportes";
import { money, fechaHora } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
const pct = (p: number, t: number) => (t > 0 ? Math.round((p / t) * 100) : 0);

export default async function ReportesPage() {
  const user = await requirePermission("reporte.ver");
  const veAud = hasPermission(user, "reporte.auditoria");
  const sede = user.sede?.id ?? null;
  const [resumen, avance, aud] = await Promise.all([
    resumenVentas(user.tenant.id, sede),
    avancePorRifa(user.tenant.id, sede),
    veAud ? verificarAuditoria(user.tenant.id) : Promise.resolve(null),
  ]);

  const tarjetas = [
    { l: "Recaudado", v: money(resumen.recaudado), c: "text-emerald-600 dark:text-emerald-400" },
    { l: "Facturado", v: money(resumen.facturado), c: "text-slate-900 dark:text-white" },
    { l: "Por cobrar", v: money(resumen.porCobrar), c: "text-amber-600 dark:text-amber-400" },
    { l: "Ventas pagadas", v: `${resumen.ventasPagadas}/${resumen.ventas}`, c: "text-slate-900 dark:text-white" },
  ];

  const descarga = "no-print rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div>
      <style>{"@media print{header{display:none!important}.no-print{display:none!important}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle icon="reportes">Reportes</PageTitle>
        <div className="no-print flex flex-wrap items-center gap-2">
          <a href="/api/export/ventas" className={descarga}>⬇ Ventas CSV</a>
          <a href="/api/export/cartera" className={descarga}>⬇ Cartera CSV</a>
          <a href="/api/export/avance" className={descarga}>⬇ Avance CSV</a>
          {veAud ? <a href="/api/export/auditoria" className={descarga}>⬇ Auditoría CSV</a> : null}
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.l} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className={`text-xl font-bold ${t.c}`}>{t.v}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.l}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Avance por rifa</h2>
        {avance.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin rifas.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {avance.map((a) => {
              const vendidas = a.pagadas + a.reservadas;
              return (
                <div key={String(a.rifaId)} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div><span className="font-mono text-sm text-slate-900 dark:text-slate-100">{a.codigo}</span><span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{a.nombre}</span></div>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{money(a.recaudo)}</span>
                  </div>
                  <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="bg-emerald-500" style={{ width: `${pct(a.pagadas, a.totalBoletas)}%` }} />
                    <div className="bg-amber-400" style={{ width: `${pct(a.reservadas, a.totalBoletas)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {vendidas.toLocaleString("es-CO")} de {a.totalBoletas.toLocaleString("es-CO")} ({pct(vendidas, a.totalBoletas)}%) · <span className="text-emerald-600 dark:text-emerald-400">{a.pagadas} pagadas</span> · <span className="text-amber-600 dark:text-amber-400">{a.reservadas} reservadas</span> · {a.disponibles.toLocaleString("es-CO")} disponibles
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {aud ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Integridad de auditoría</h2>
          <div className={`mt-3 flex items-center gap-3 rounded-xl border p-4 ${aud.integra ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}>
            <span className="text-2xl">{aud.integra ? "✓" : "⚠"}</span>
            <div>
              <p className={`font-semibold ${aud.integra ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>{aud.integra ? "Cadena íntegra" : `Cadena alterada en el evento #${aud.rotaEnId}`}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{aud.totalEventos.toLocaleString("es-CO")} eventos de tu empresa · hash encadenado SHA-256</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-4 py-3 font-medium">#</th><th className="px-4 py-3 font-medium">Acción</th><th className="px-4 py-3 font-medium">Entidad</th><th className="px-4 py-3 font-medium">Actor</th><th className="px-4 py-3 font-medium">Fecha</th><th className="px-4 py-3 font-medium">Hash</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {aud.recientes.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">{e.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{e.accion}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{e.entidad}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{e.actorTipo}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{fechaHora(e.fecha)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.hash?.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
