import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarVendedores } from "@/lib/vendedores";
import { cambiarEstadoVendedorAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  suspendido: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  inactivo: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; estado?: string; error?: string }>;
}) {
  const user = await requirePermission("vendedor.ver");
  const { creado, estado, error } = await searchParams;
  const vendedores = await listarVendedores();

  const puedeCrear = hasPermission(user, "vendedor.crear");
  const puedeEditar = hasPermission(user, "vendedor.editar");
  // Documento y teléfono son datos personales: requieren permiso específico.
  const vePii = hasPermission(user, "vendedor.ver_pii");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Vendedores</h1>
        {puedeCrear ? (
          <Link
            href="/admin/vendedores/nuevo"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Nuevo vendedor
          </Link>
        ) : null}
      </div>

      {creado || estado ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Cambio aplicado correctamente.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {vendedores.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Aún no hay vendedores registrados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 text-right font-medium">Comisión</th>
                <th className="px-4 py-3 text-right font-medium">Cupo</th>
                <th className="px-4 py-3 text-right font-medium">Talonarios</th>
                <th className="px-4 py-3 text-right font-medium">Ventas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {vendedores.map((v) => (
                <tr key={String(v.id)}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vendedores/${v.id}`}
                      className="font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {v.nombre}
                    </Link>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {vePii ? `${v.documento} · ${v.telefono}` : "datos protegidos"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {Number(v.pct_comision.toString())}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {v.cupo_max?.toLocaleString("es-CO") ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {v._count.talonarios}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {v._count.ventas}
                  </td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <form
                        action={cambiarEstadoVendedorAction}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="vendedor_id" value={String(v.id)} />
                        <select
                          name="estado"
                          defaultValue={v.estado}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="activo">activo</option>
                          <option value="suspendido">suspendido</option>
                          <option value="inactivo">inactivo</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          estadoClase[v.estado] ?? estadoClase.inactivo
                        }`}
                      >
                        {v.estado}
                      </span>
                    )}
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
