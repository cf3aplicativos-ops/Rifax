import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { listarCartera, resumirCartera, tramoLabel, tramoClase } from "@/lib/cartera";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CarteraPage() {
  const user = await requirePermission("cartera.ver");
  const filas = await listarCartera(user.tenant.id, user.sede?.id ?? null);
  const resumen = resumirCartera(filas);

  return (
    <div>
      <PageTitle icon="cartera">Cartera</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ventas con saldo pendiente, por antigüedad.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{money(resumen.totalSaldo)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{resumen.cuentas}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cuentas por cobrar</p>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No hay saldos pendientes.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr><th className="px-4 py-3 font-medium">Venta</th><th className="px-4 py-3 font-medium">Cliente</th><th className="px-4 py-3 text-right font-medium">Saldo</th><th className="px-4 py-3 text-right font-medium">Días</th><th className="px-4 py-3 font-medium">Tramo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {filas.map((f) => (
                <tr key={String(f.venta_id)}>
                  <td className="px-4 py-3"><Link href={`/app/ventas/${f.venta_id}`} className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400">{f.codigo}</Link></td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{f.cliente}<span className="block text-xs text-slate-500 dark:text-slate-400">{f.telefono}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">{money(f.saldo)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{f.dias_antiguedad}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tramoClase[f.tramo] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{tramoLabel[f.tramo] ?? f.tramo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
