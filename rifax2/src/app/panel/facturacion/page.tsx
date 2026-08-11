import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requireSuper } from "@/lib/auth/rbac";
import { listarTenants } from "@/lib/superadmin";
import { getConfigPlataforma } from "@/lib/plataforma";
import { listarFacturas } from "@/lib/facturacion";
import { money, fechaHora } from "@/lib/format";
import { guardarPrecioAction, generarIndividualAction, generarMasivaAction, marcarPagadaAction, anularFacturaAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoFac: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pagada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  anulada: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ precio?: string; gen?: string; masiva?: string; pago?: string; anulada?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const [config, tenants, facturas] = await Promise.all([getConfigPlataforma(), listarTenants(), listarFacturas()]);
  const periodo = periodoActual();

  return (
    <div>
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a empresas</Link>
      <PageTitle icon="cartera" className="mt-2">Facturación</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Genera facturas y controla pagos. La suspensión por mora se aplica desde el estado de la empresa.</p>

      {sp.precio ? <Aviso tipo="ok">Precio del plan básico actualizado.</Aviso> : null}
      {sp.gen ? <Aviso tipo="ok">Factura generada.</Aviso> : null}
      {sp.masiva ? <Aviso tipo="ok">Facturación masiva: {sp.masiva} factura(s) nueva(s).</Aviso> : null}
      {sp.pago ? <Aviso tipo="ok">Factura marcada como pagada.</Aviso> : null}
      {sp.anulada ? <Aviso tipo="ok">Factura anulada.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {/* Precio configurable + facturación masiva */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form action={guardarPrecioAction} className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Precios y sedes de los planes</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Plan Básico (COP / mes, según periodicidad de pago)</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Mensual</label>
              <input name="precio_basico_mensual" type="number" min={0} step={1000} defaultValue={config.precioBasicoMensual} className={ctrl} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Semestral</label>
              <input name="precio_basico_semestral" type="number" min={0} step={1000} defaultValue={config.precioBasicoSemestral} className={ctrl} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Anual</label>
              <input name="precio_basico_anual" type="number" min={0} step={1000} defaultValue={config.precioBasicoAnual} className={ctrl} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Sedes incluidas · Básico</label>
              <input name="sedes_basico" type="number" min={1} defaultValue={config.sedesBasico} className={ctrl} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Sedes incluidas · Corporativo</label>
              <input name="sedes_corporativo" type="number" min={1} defaultValue={config.sedesCorporativo} className={ctrl} />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Plan Corporativo (texto del precio)</label>
            <input name="precio_corporativo_texto" defaultValue={config.precioCorporativoTexto} className={ctrl} />
          </div>
          <button type="submit" className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar precios</button>
          <p className="mt-2 text-xs text-slate-400">Estos valores se usan en la landing y en la facturación automática del plan básico.</p>
        </form>

        <form action={generarMasivaAction} className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Facturación masiva</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Genera la factura del periodo para todas las empresas activas (básico al precio configurado; corporativo en 0 para ajustar).</p>
          <div className="mt-3 flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Periodo</label>
              <input name="periodo" defaultValue={periodo} placeholder="AAAA-MM" className={`${ctrl} w-32`} />
            </div>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Generar a todas</button>
          </div>
        </form>
      </div>

      {/* Generar individual */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Generar factura individual</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((t) => (
            <form key={t.id} action={generarIndividualAction} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <input type="hidden" name="tenant_id" value={t.id} />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.nombre}</p>
              <p className="text-xs text-slate-400">Plan {t.plan}</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Periodo</label>
                  <input name="periodo" defaultValue={periodo} className={`${ctrl} w-28`} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">Monto</label>
                  <input name="monto" placeholder="auto" className={`${ctrl} w-24`} />
                </div>
                <button type="submit" className={btnSec}>Generar</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      {/* Historial de facturas */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Facturas ({facturas.length})</h2>
        {facturas.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Aún no hay facturas.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">Periodo</th><th className="px-4 py-2">Monto</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2">Emitida</th><th className="px-4 py-2">Acción</th></tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{f.tenant}</td>
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">{f.periodo}</td>
                    <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">{money(f.monto)}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoFac[f.estado] ?? estadoFac.pendiente}`}>{f.estado}</span></td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{fechaHora(f.emitidaEn)}</td>
                    <td className="px-4 py-2">
                      {f.estado === "pendiente" ? (
                        <div className="flex gap-1">
                          <form action={marcarPagadaAction}><input type="hidden" name="factura_id" value={f.id} /><button className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300">Pagada</button></form>
                          <form action={anularFacturaAction}><input type="hidden" name="factura_id" value={f.id} /><button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400">Anular</button></form>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const ctrl = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const btnSec = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
