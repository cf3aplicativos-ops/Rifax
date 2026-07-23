import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listarCartera, resumirCartera, tramoLabel, tramoClase } from "@/lib/cartera";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CarteraPage() {
  await requirePermission("cartera.ver");
  const filas = await listarCartera();
  const resumen = resumirCartera(filas);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Cartera</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Ventas con saldo pendiente, clasificadas por antigüedad.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {money(resumen.totalSaldo)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Saldo total</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{resumen.cuentas}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cuentas por cobrar</p>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No hay saldos pendientes. Toda la cartera está al día.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Venta</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                <th className="px-4 py-3 text-right font-medium">Días</th>
                <th className="px-4 py-3 font-medium">Tramo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {filas.map((f) => (
                <tr key={String(f.venta_id)}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ventas/${f.venta_id}`}
                      className="font-mono text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {f.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {f.cliente}
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {f.telefono}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {money(f.saldo)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {f.dias_antiguedad}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tramoClase[f.tramo] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {tramoLabel[f.tramo] ?? f.tramo}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
