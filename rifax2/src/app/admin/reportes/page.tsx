import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { resumenVentas, avancePorRifa, verificarAuditoria } from "@/lib/reportes";
import { money, fechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export default async function ReportesPage() {
  const user = await requirePermission("reporte.ver");
  const veAuditoria = hasPermission(user, "reporte.auditoria");

  const [resumen, avance, auditoria] = await Promise.all([
    resumenVentas(),
    avancePorRifa(),
    veAuditoria ? verificarAuditoria() : Promise.resolve(null),
  ]);

  const tarjetas = [
    { label: "Recaudado", value: money(resumen.recaudado), tono: "text-green-600 dark:text-green-400" },
    { label: "Facturado", value: money(resumen.facturado), tono: "text-zinc-900 dark:text-zinc-50" },
    { label: "Por cobrar", value: money(resumen.porCobrar), tono: "text-amber-600 dark:text-amber-400" },
    { label: "Ventas pagadas", value: `${resumen.ventasPagadas}/${resumen.ventas}`, tono: "text-zinc-900 dark:text-zinc-50" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Reportes</h1>

      {/* RESUMEN */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className={`text-xl font-bold ${t.tono}`}>{t.value}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t.label}</p>
          </div>
        ))}
      </div>

      {/* AVANCE POR RIFA */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Avance por rifa</h2>
        {avance.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sin rifas.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {avance.map((a) => {
              const vendidas = a.pagadas + a.reservadas;
              return (
                <div
                  key={String(a.rifaId)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                        {a.codigo}
                      </span>
                      <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {a.nombre}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {money(a.recaudo)}
                    </span>
                  </div>

                  {/* Barra de avance: pagadas + reservadas sobre el total */}
                  <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="bg-green-500"
                      style={{ width: `${pct(a.pagadas, a.totalBoletas)}%` }}
                      title={`${a.pagadas} pagadas`}
                    />
                    <div
                      className="bg-amber-400"
                      style={{ width: `${pct(a.reservadas, a.totalBoletas)}%` }}
                      title={`${a.reservadas} reservadas`}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {vendidas.toLocaleString("es-CO")} de {a.totalBoletas.toLocaleString("es-CO")}{" "}
                    boletas ({pct(vendidas, a.totalBoletas)}%) ·{" "}
                    <span className="text-green-600 dark:text-green-400">{a.pagadas} pagadas</span> ·{" "}
                    <span className="text-amber-600 dark:text-amber-400">
                      {a.reservadas} reservadas
                    </span>{" "}
                    · {a.disponibles.toLocaleString("es-CO")} disponibles
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AUDITORÍA */}
      {auditoria ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Integridad de auditoría
          </h2>

          <div
            className={`mt-3 flex items-center gap-3 rounded-xl border p-4 ${
              auditoria.integra
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
            }`}
          >
            <span className="text-2xl">{auditoria.integra ? "✓" : "⚠"}</span>
            <div>
              <p
                className={`font-semibold ${
                  auditoria.integra
                    ? "text-green-800 dark:text-green-300"
                    : "text-red-800 dark:text-red-300"
                }`}
              >
                {auditoria.integra
                  ? "Cadena íntegra"
                  : `Cadena alterada en el evento #${auditoria.rotaEnId}`}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {auditoria.totalEventos.toLocaleString("es-CO")} eventos verificados por hash
                encadenado (SHA-256)
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {auditoria.recientes.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">{e.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {e.accion}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{e.entidad}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{e.actorTipo}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {fechaHora(e.fecha)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {e.hash?.slice(0, 12)}…
                    </td>
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
