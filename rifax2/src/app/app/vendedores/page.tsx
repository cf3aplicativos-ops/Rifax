import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarVendedores } from "@/lib/vendedores";
import { cambiarEstadoVendedorAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  suspendido: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  inactivo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function VendedoresPage({ searchParams }: { searchParams: Promise<{ creado?: string; estado?: string; error?: string }> }) {
  const user = await requirePermission("vendedor.ver");
  const { creado, estado, error } = await searchParams;
  const vendedores = await listarVendedores(user.tenant.id, user.sede?.id ?? null);
  const puedeCrear = hasPermission(user, "vendedor.crear");
  const puedeEditar = hasPermission(user, "vendedor.editar");
  const vePii = hasPermission(user, "vendedor.ver_pii");

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageTitle icon="vendedores">Vendedores</PageTitle>
        {puedeCrear ? <Link href="/app/vendedores/nuevo" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">+ Nuevo vendedor</Link> : null}
      </div>
      {creado || estado ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Cambio aplicado.</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p> : null}

      {vendedores.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Aún no hay vendedores.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Sede</th>
                <th className="px-4 py-3 text-right font-medium">Comisión</th>
                <th className="px-4 py-3 text-right font-medium">Cupo</th>
                <th className="px-4 py-3 text-right font-medium">Talonarios</th>
                <th className="px-4 py-3 text-right font-medium">Ventas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {vendedores.map((v) => (
                <tr key={String(v.id)}>
                  <td className="px-4 py-3">
                    <Link href={`/app/vendedores/${v.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{v.nombre}</Link>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{vePii ? `${v.documento} · ${v.telefono}` : "datos protegidos"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {v.sedes ? (
                      <span className="text-slate-700 dark:text-slate-300">{v.sedes.nombre}</span>
                    ) : (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Todas las sedes</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{Number(v.pct_comision.toString())}%</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{v.cupo_max?.toLocaleString("es-CO") ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{v._count.talonarios}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{v._count.ventas}</td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <form action={cambiarEstadoVendedorAction} className="flex items-center gap-1">
                        <input type="hidden" name="vendedor_id" value={String(v.id)} />
                        <select name="estado" defaultValue={v.estado} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          <option value="activo">activo</option>
                          <option value="suspendido">suspendido</option>
                          <option value="inactivo">inactivo</option>
                        </select>
                        <button type="submit" aria-label="Guardar estado" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">✓</button>
                      </form>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[v.estado] ?? estadoClase.inactivo}`}>{v.estado}</span>
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
