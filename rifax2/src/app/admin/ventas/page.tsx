import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarVentas } from "@/lib/ventas";
import { money, fecha, estadoVentaClase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const user = await requirePermission("venta.ver");
  const ventas = await listarVentas();
  const puedeCrear = hasPermission(user, "venta.crear");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Ventas</h1>
        {puedeCrear ? (
          <Link
            href="/admin/ventas/nueva"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Nueva venta
          </Link>
        ) : null}
      </div>

      {ventas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Aún no hay ventas registradas.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Rifa</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Cant.</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {ventas.map((v) => (
                <tr key={String(v.id)} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ventas/${v.id}`}
                      className="font-mono text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      {v.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {v.rifas.codigo}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {v.clientes.nombre}
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {v.clientes.telefono}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {v.cantidad}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {money(v.total)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {money(v.saldo)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        estadoVentaClase[v.estado] ?? estadoVentaClase.pendiente_pago
                      }`}
                    >
                      {v.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {fecha(v.creado_en)}
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
