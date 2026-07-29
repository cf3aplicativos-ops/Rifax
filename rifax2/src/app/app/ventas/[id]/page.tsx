import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerVenta } from "@/lib/ventas";
import { money, fechaHora, estadoVentaClase } from "@/lib/format";
import { registrarAbonoAction, anularVentaAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function VentaDetalle({
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
  const venta = await obtenerVenta(user.tenant.id, ventaId);
  if (!venta) notFound();

  const puedeAbonar = hasPermission(user, "pago.registrar");
  const puedeAnular = hasPermission(user, "venta.anular");
  const cerrada = venta.estado === "anulada" || venta.estado === "pagada";
  const abonado = Number(venta.total.toString()) - Number(venta.saldo.toString());

  return (
    <div className="max-w-3xl">
      <Link href="/app/ventas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a ventas
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">{venta.codigo}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoVentaClase[venta.estado] ?? estadoVentaClase.pendiente_pago}`}>
          {venta.estado.replace("_", " ")}
        </span>
        <Link href={`/app/ventas/${venta.id}/recibo`} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          🖨️ Imprimir recibo
        </Link>
      </div>

      {abono ? <Aviso tipo="ok">Abono registrado.</Aviso> : null}
      {anulada ? <Aviso tipo="neutral">Venta anulada; sus boletas volvieron a estar disponibles.</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card titulo="Cliente">
          <p className="text-slate-900 dark:text-slate-100">{venta.clientes.nombre}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{venta.clientes.telefono}</p>
          {venta.clientes.correo ? <p className="text-sm text-slate-500 dark:text-slate-400">{venta.clientes.correo}</p> : null}
        </Card>
        <Card titulo="Rifa">
          <p className="text-slate-900 dark:text-slate-100">{venta.rifas.codigo}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{venta.rifas.nombre}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card titulo="Total"><p className="text-lg font-bold text-slate-900 dark:text-white">{money(venta.total)}</p></Card>
        <Card titulo="Abonado"><p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{money(abonado)}</p></Card>
        <Card titulo="Saldo"><p className="text-lg font-bold text-slate-900 dark:text-white">{money(venta.saldo)}</p></Card>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Boletas ({venta.ventas_boletas.length})</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {venta.ventas_boletas.map((vb) => (
            <span key={String(vb.boleta_id)} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {vb.boletas.numero}
            </span>
          ))}
        </div>
      </section>

      {venta.abonos.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Abonos</h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {venta.abonos.map((a) => (
              <li key={String(a.id)} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">{fechaHora(a.registrado_en)} · {a.origen}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{money(a.monto)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!cerrada && (puedeAbonar || puedeAnular) ? (
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {puedeAbonar ? (
            <form action={registrarAbonoAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <input type="hidden" name="venta_id" value={String(venta.id)} />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Registrar abono</h3>
              <input name="monto" type="number" min="1" step="0.01" required placeholder="Monto" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              <select name="origen" defaultValue="efectivo" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <option value="efectivo">Efectivo</option>
                <option value="pasarela">Pasarela</option>
                <option value="comprobante">Comprobante</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Abonar</button>
            </form>
          ) : null}
          {puedeAnular ? (
            <form action={anularVentaAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <input type="hidden" name="venta_id" value={String(venta.id)} />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Anular venta</h3>
              <input name="motivo" required placeholder="Motivo de anulación" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              <button type="submit" className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Anular y liberar boletas</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{titulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error" | "neutral"; children: React.ReactNode }) {
  const clase =
    tipo === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : tipo === "error"
        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
