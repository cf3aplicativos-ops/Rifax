import { headers } from "next/headers";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { PageTitle } from "@/components/icons";
import { estadoComisiones, comisionesDetalladas } from "@/lib/comisiones";
import { vendedorIdDeUsuario } from "@/lib/portal-vendedor";
import { money, fecha } from "@/lib/format";
import PrintButton from "@/components/PrintButton";
import { liquidarVendedorAction, liquidarMasivoAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ComisionesPage({ searchParams }: { searchParams: Promise<{ liquidado?: string; masivo?: string; error?: string }> }) {
  const user = await requirePermission("cartera.ver");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const sp = await searchParams;
  const [todas, detalleTodas] = await Promise.all([
    estadoComisiones(user.tenant.id),
    comisionesDetalladas(user.tenant.id, user.sede?.id ?? null),
  ]);
  // Un vendedor solo ve su propia comisión.
  const vendedorId = user.rol === "vendedor" ? await vendedorIdDeUsuario(user.tenant.id, user.id) : null;
  const comisiones = vendedorId ? todas.filter((c) => c.id === vendedorId) : todas;
  const detalle = vendedorId ? detalleTodas.filter((d) => d.vendedorId === String(vendedorId)) : detalleTodas;
  const puedeLiquidar = hasPermission(user, "pago.conciliar");
  const descarga = "no-print rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  const tot = comisiones.reduce(
    (a, c) => ({ ganada: a.ganada + c.comisionGanada, liquidado: a.liquidado + c.liquidado, pendiente: a.pendiente + c.pendiente }),
    { ganada: 0, liquidado: 0, pendiente: 0 },
  );
  const hayPendientes = comisiones.some((c) => c.pendiente > 0);

  return (
    <div>
      <style nonce={nonce}>{"@media print{header{display:none!important}.no-print{display:none!important}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle icon="comisiones">Comisiones</PageTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Comisión ganada = recaudado del vendedor × su %.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/export/comisiones" className={descarga}>⬇ Consolidado CSV</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/export/comisiones-detalle" className={descarga}>⬇ Detallado CSV</a>
          <PrintButton label="Imprimir" />
          {puedeLiquidar && hayPendientes ? (
            <form action={liquidarMasivoAction}>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Liquidar todo</button>
            </form>
          ) : null}
        </div>
      </div>

      {sp.liquidado ? <Aviso tipo="ok">Comisión liquidada.</Aviso> : null}
      {sp.masivo ? <Aviso tipo="ok">Liquidación masiva realizada para {sp.masivo} vendedor(es).</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Kpi v={money(tot.ganada)} l="Comisión ganada" />
        <Kpi v={money(tot.liquidado)} l="Liquidado" tono="text-emerald-600 dark:text-emerald-400" />
        <Kpi v={money(tot.pendiente)} l="Pendiente" tono="text-amber-600 dark:text-amber-400" />
      </div>

      {comisiones.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No hay vendedores.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr><th className="px-4 py-3 font-medium">Vendedor</th><th className="px-4 py-3 text-right font-medium">%</th><th className="px-4 py-3 text-right font-medium">Recaudado</th><th className="px-4 py-3 text-right font-medium">Comisión</th><th className="px-4 py-3 text-right font-medium">Liquidado</th><th className="px-4 py-3 text-right font-medium">Pendiente</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {comisiones.map((c) => (
                <tr key={String(c.id)}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{c.pct}%</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{money(c.recaudado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">{money(c.comisionGanada)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{money(c.liquidado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">{money(c.pendiente)}</td>
                  <td className="px-4 py-3 text-right">
                    {puedeLiquidar && c.pendiente > 0 ? (
                      <form action={liquidarVendedorAction}>
                        <input type="hidden" name="vendedor_id" value={String(c.id)} />
                        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Liquidar</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold text-slate-900 dark:text-white">Detalle por venta</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Informe aparte del consolidado: cada fila es una venta, con sus números de boleta.</p>
      {detalle.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No hay ventas con comisión todavía.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Venta</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Rifa</th>
                <th className="px-4 py-3 font-medium">Boletas</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Recaudado</th>
                <th className="px-4 py-3 text-right font-medium">%</th>
                <th className="px-4 py-3 text-right font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {detalle.map((d) => (
                <tr key={d.ventaId}>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{d.codigo}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{fecha(d.fecha)}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{d.vendedorNombre}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{d.rifaCodigo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{d.boletas.join(", ")}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{d.cliente}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{money(d.recaudadoVenta)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{d.pct}%</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{money(d.comisionVenta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ v, l, tono }: { v: string; l: string; tono?: string }) {
  return <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p className={`text-xl font-bold ${tono ?? "text-slate-900 dark:text-white"}`}>{v}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l}</p></div>;
}
function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const c = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${c}`}>{children}</p>;
}
