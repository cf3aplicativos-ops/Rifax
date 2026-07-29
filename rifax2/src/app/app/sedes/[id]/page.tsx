import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { estadoSedes, boletasPorEstado, carteraPorTramo, topVendedores } from "@/lib/dashboard";
import { BarChart, Donut } from "@/components/charts";
import { money } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
const tramoLabel: Record<string, string> = { corriente: "Corriente", mora_1: "Mora 8–15d", mora_2: "Mora 16–30d", mora_3: "Mora +30d" };

export default async function SedeRadiografia({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("sede.ver");
  const { id } = await params;
  let sedeId: bigint;
  try { sedeId = BigInt(id); } catch { notFound(); }

  // Un usuario acotado a una sede solo ve la suya.
  if (user.sede && user.sede.id !== sedeId) notFound();
  const sede = await prisma.sedes.findFirst({ where: { id: sedeId, tenant_id: user.tenant.id } });
  if (!sede) notFound();

  const [sedes, boletas, tramos, top] = await Promise.all([
    estadoSedes(user.tenant.id),
    boletasPorEstado(user.tenant.id, sedeId),
    carteraPorTramo(user.tenant.id, sedeId),
    topVendedores(user.tenant.id, sedeId),
  ]);
  const resumen = sedes.find((s) => s.id === sedeId);

  const boletasVendidas = boletas.pagada + boletas.reservada;
  const boletasChart = [
    { label: "Pagadas", value: boletas.pagada, color: "#10b981" },
    { label: "Reservadas", value: boletas.reservada, color: "#f59e0b" },
    { label: "Disponibles", value: boletas.disponible, color: "#cbd5e1" },
  ];
  const recaudadoTotal = top.reduce((a, v) => a + Number(v.recaudado), 0);

  return (
    <div>
      <style>{"@media print{header{display:none!important}.no-print{display:none!important}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/sedes" className="no-print text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a sedes</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Radiografía · {sede.nombre}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{sede.direccion ?? "sin dirección"} · {sede.estado}</p>
        </div>
        <PrintButton label="Imprimir radiografía" />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi v={money(resumen?.recaudado ?? "0")} l="Recaudado" tono="text-emerald-600 dark:text-emerald-400" />
        <Kpi v={money(resumen?.cartera ?? "0")} l="Cartera pendiente" tono="text-amber-600 dark:text-amber-400" />
        <Kpi v={String(resumen?.ventas ?? 0)} l="Ventas" />
        <Kpi v={String(resumen?.rifasActivas ?? 0)} l="Rifas activas" />
      </div>

      {/* Gráficas */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Boletas ({boletasVendidas.toLocaleString("es-CO")} vendidas)</h2>
          <div className="mt-4"><Donut data={boletasChart} /></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cartera por antigüedad</h2>
          <div className="mt-4"><BarChart data={tramos.map((t) => ({ label: tramoLabel[t.tramo] ?? t.tramo, value: t.saldo }))} format={money} color="#f59e0b" /></div>
        </div>
      </div>

      {/* Top vendedores */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Top vendedores</h2>
        {top.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aún no hay ventas de vendedores en esta sede.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-4 py-2 font-medium">#</th><th className="px-4 py-2 font-medium">Vendedor</th><th className="px-4 py-2 text-right font-medium">Ventas</th><th className="px-4 py-2 text-right font-medium">Recaudado</th><th className="px-4 py-2 text-right font-medium">% Part.</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {top.map((v, i) => (
                  <tr key={String(v.id)}>
                    <td className="px-4 py-2 tabular-nums text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{v.nombre} <span className="text-xs text-slate-400">({v.pctComision}%)</span></td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{v.ventas}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{money(v.recaudado)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{recaudadoTotal > 0 ? Math.round((Number(v.recaudado) / recaudadoTotal) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ v, l, tono }: { v: string; l: string; tono?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className={`text-xl font-bold ${tono ?? "text-slate-900 dark:text-white"}`}>{v}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l}</p>
    </div>
  );
}
