import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerVenta } from "@/lib/ventas";
import { money, fechaHora, estadoVentaClase } from "@/lib/format";
import { registrarAbonoAction, anularVentaAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function VentaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ abono?: string; anulada?: string; error?: string }>;
}) {
  const user = await requirePermission("venta.ver");
  const { id } = await params;
  const { abono, anulada, error } = await searchParams;

  let ventaId: bigint;
  try {
    ventaId = BigInt(id);
  } catch {
    notFound();
  }

  const venta = await obtenerVenta(ventaId);
  if (!venta) notFound();

  const puedeAbonar = hasPermission(user, "pago.registrar");
  const puedeAnular = hasPermission(user, "venta.anular");
  const cerrada = venta.estado === "anulada" || venta.estado === "pagada";
  const abonado = Number(venta.total.toString()) - Number(venta.saldo.toString());

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/ventas"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a ventas
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {venta.codigo}
        </h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            estadoVentaClase[venta.estado] ?? estadoVentaClase.pendiente_pago
          }`}
        >
          {venta.estado.replace("_", " ")}
        </span>
      </div>

      {abono ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Abono registrado.
        </p>
      ) : null}
      {anulada ? (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Venta anulada; sus boletas volvieron a estar disponibles.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Cliente</h2>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100">{venta.clientes.nombre}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{venta.clientes.telefono}</p>
          {venta.clientes.correo ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{venta.clientes.correo}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Rifa</h2>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100">{venta.rifas.codigo}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{venta.rifas.nombre}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{money(venta.total)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Abonado</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{money(abonado)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Saldo</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{money(venta.saldo)}</p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Boletas ({venta.ventas_boletas.length})
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {venta.ventas_boletas.map((vb) => (
            <span
              key={String(vb.boleta_id)}
              className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {vb.boletas.numero}
            </span>
          ))}
        </div>
      </section>

      {venta.abonos.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Abonos</h2>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {venta.abonos.map((a) => (
              <li
                key={String(a.id)}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-zinc-600 dark:text-zinc-400">
                  {fechaHora(a.registrado_en)} · {a.origen}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {money(a.monto)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!cerrada && (puedeAbonar || puedeAnular) ? (
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {puedeAbonar ? (
            <form
              action={registrarAbonoAction}
              className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <input type="hidden" name="venta_id" value={String(venta.id)} />
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Registrar abono
              </h3>
              <input
                name="monto"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Monto"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <select
                name="origen"
                defaultValue="efectivo"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="efectivo">Efectivo</option>
                <option value="pasarela">Pasarela</option>
                <option value="comprobante">Comprobante</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Abonar
              </button>
            </form>
          ) : null}

          {puedeAnular ? (
            <form
              action={anularVentaAction}
              className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <input type="hidden" name="venta_id" value={String(venta.id)} />
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Anular venta
              </h3>
              <input
                name="motivo"
                required
                placeholder="Motivo de anulación"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Anular y liberar boletas
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
