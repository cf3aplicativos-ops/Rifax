import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarVentas } from "@/lib/ventas";
import { money, fecha, estadoVentaClase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const user = await requirePermission("venta.ver");
  const ventas = await listarVentas(user.tenant.id, user.sede?.id ?? null);
  const puedeCrear = hasPermission(user, "venta.crear");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ventas</h1>
        {puedeCrear ? (
          <Link href="/app/ventas/nueva" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
            + Nueva venta
          </Link>
        ) : null}
      </div>

      {ventas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no hay ventas registradas.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Rifa</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {ventas.map((v) => (
                <tr key={String(v.id)} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="px-4 py-3">
                    <Link href={`/app/ventas/${v.id}`} className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400">{v.codigo}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{v.rifas.codigo}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {v.clientes.nombre}
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{v.clientes.telefono}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{money(v.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">{money(v.saldo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoVentaClase[v.estado] ?? estadoVentaClase.pendiente_pago}`}>
                      {v.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{fecha(v.creado_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
