import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarRifas, resumenSedesCompartidas } from "@/lib/rifas";
import { vendedorIdDeUsuario } from "@/lib/portal-vendedor";
import { money, fecha } from "@/lib/format";
import { publicarRifaAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  activa: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  pausada: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cerrada: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  sorteada: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
};

export default async function RifasPage({
  searchParams,
}: {
  searchParams: Promise<{ publicada?: string; error?: string }>;
}) {
  const user = await requirePermission("rifa.ver");
  const { publicada, error } = await searchParams;
  const vendedorId = user.rol === "vendedor" ? await vendedorIdDeUsuario(user.tenant.id, user.id) : null;
  const [rifas, resumen] = await Promise.all([
    listarRifas(user.tenant.id, user.sede?.id ?? null, vendedorId),
    resumenSedesCompartidas(user.tenant.id),
  ]);

  const puedeCrear = hasPermission(user, "rifa.crear");
  const puedePublicar = hasPermission(user, "rifa.publicar");

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageTitle icon="rifas">Rifas</PageTitle>
        {puedeCrear ? (
          <Link
            href="/app/rifas/nueva"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            + Nueva rifa
          </Link>
        ) : null}
      </div>

      {publicada ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Rifa publicada. Se materializaron {publicada} boletas.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {rifas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no hay rifas. Crea la primera para empezar.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Sede</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Boletas</th>
                <th className="px-4 py-3 font-medium">Sorteo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {rifas.map((r) => (
                <tr key={String(r.id)}>
                  <td className="px-4 py-3"><Link href={`/app/rifas/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400">{r.codigo}</Link></td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{r.nombre}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {resumen[String(r.id)] ? (
                      <div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">Todas las sedes</span>
                        <div className="mt-1 space-y-0.5">
                          {resumen[String(r.id)].map((rs) => (
                            <p key={rs.sede} className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span className={rs.sede === "sin asignar" ? "text-amber-600 dark:text-amber-400" : ""}>{rs.sede}</span>: {rs.disponibles.toLocaleString("es-CO")} disp. / {rs.total.toLocaleString("es-CO")}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : r.sedes.nombre}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[r.estado] ?? estadoClase.borrador}`}>
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{money(r.precio_boleta)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{r.total_boletas.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{fecha(r.fecha_sorteo)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.estado === "borrador" && puedePublicar ? (
                      <form action={publicarRifaAction}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Publicar
                        </button>
                      </form>
                    ) : null}
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
