import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerVendedor } from "@/lib/vendedores";
import { prisma } from "@/lib/prisma";
import { fecha } from "@/lib/format";
import { asignarTalonarioAction, cerrarTalonarioAction } from "../actions";

export const dynamic = "force-dynamic";

const talonarioClase: Record<string, string> = {
  asignado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  en_venta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  rendido: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cerrado: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function VendedorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asignadas?: string; liberadas?: string; error?: string }>;
}) {
  const user = await requirePermission("vendedor.ver");
  const { id } = await params;
  const { asignadas, liberadas, error } = await searchParams;

  let vendedorId: bigint;
  try {
    vendedorId = BigInt(id);
  } catch {
    notFound();
  }

  const vendedor = await obtenerVendedor(vendedorId);
  if (!vendedor) notFound();

  const rifas = await prisma.rifas.findMany({
    where: { estado: "activa" },
    orderBy: { id: "desc" },
    select: { id: true, codigo: true, nombre: true, numero_min: true, numero_max: true },
  });

  const puedeAsignar = hasPermission(user, "talonario.asignar");
  const puedeCerrar = hasPermission(user, "talonario.devolver");
  const vePii = hasPermission(user, "vendedor.ver_pii");

  const boletasAsignadas = vendedor.talonarios
    .filter((t) => t.estado !== "cerrado")
    .reduce((acc, t) => acc + (t.numero_fin - t.numero_inicio + 1), 0);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/vendedores"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a vendedores
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {vendedor.nombre}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {vePii ? `${vendedor.documento} · ${vendedor.telefono}` : "datos protegidos"} ·{" "}
        {Number(vendedor.pct_comision.toString())}% comisión ·{" "}
        {vendedor.cupo_max
          ? `${boletasAsignadas}/${vendedor.cupo_max} boletas`
          : `${boletasAsignadas} boletas asignadas`}
      </p>

      {asignadas ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Talonario asignado: {asignadas} boletas.
        </p>
      ) : null}
      {liberadas ? (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Talonario cerrado. Se liberaron {liberadas} boletas disponibles.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Talonarios</h2>

      {vendedor.talonarios.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Sin talonarios asignados.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Rifa</th>
                <th className="px-4 py-3 font-medium">Rango</th>
                <th className="px-4 py-3 text-right font-medium">Boletas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Asignado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {vendedor.talonarios.map((t) => (
                <tr key={String(t.id)}>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{t.rifas.codigo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {t.numero_inicio}–{t.numero_fin}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {(t.numero_fin - t.numero_inicio + 1).toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        talonarioClase[t.estado] ?? talonarioClase.cerrado
                      }`}
                    >
                      {t.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {fecha(t.asignado_en)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.estado !== "cerrado" && puedeCerrar ? (
                      <form action={cerrarTalonarioAction}>
                        <input type="hidden" name="talonario_id" value={String(t.id)} />
                        <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          Cerrar
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

      {puedeAsignar && vendedor.estado === "activo" ? (
        rifas.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            No hay rifas activas para asignar talonarios.
          </p>
        ) : (
          <form
            action={asignarTalonarioAction}
            className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Asignar talonario
            </h3>
            <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />

            <select
              name="rifa_id"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {rifas.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {r.codigo} — {r.nombre} ({r.numero_min}–{r.numero_max})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input
                name="inicio"
                type="number"
                min="0"
                step="1"
                required
                placeholder="Número inicial"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                name="fin"
                type="number"
                min="0"
                step="1"
                required
                placeholder="Número final"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Asignar
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}
