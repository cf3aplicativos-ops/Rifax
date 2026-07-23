import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarRifas } from "@/lib/rifas";
import { publicarRifaAction } from "./actions";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const estadoClase: Record<string, string> = {
  borrador: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  activa: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  pausada: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cerrada: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function RifasPage({
  searchParams,
}: {
  searchParams: Promise<{ publicada?: string; error?: string }>;
}) {
  const user = await requirePermission("rifa.ver");
  const { publicada, error } = await searchParams;
  const rifas = await listarRifas();

  const puedeCrear = hasPermission(user, "rifa.crear");
  const puedePublicar = hasPermission(user, "rifa.publicar");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Rifas</h1>
        {puedeCrear ? (
          <Link
            href="/admin/rifas/nueva"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Nueva rifa
          </Link>
        ) : null}
      </div>

      {publicada ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Rifa publicada. Se materializaron {publicada} boletas.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {rifas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Aún no hay rifas. Crea la primera para empezar.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Boletas</th>
                <th className="px-4 py-3 font-medium">Sorteo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {rifas.map((r) => (
                <tr key={String(r.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {r.codigo}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {r.nombre}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        estadoClase[r.estado] ?? estadoClase.borrador
                      }`}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {money.format(Number(r.precio_boleta.toString()))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {r.total_boletas.toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.fecha_sorteo.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.estado === "borrador" && puedePublicar ? (
                      <form action={publicarRifaAction}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
