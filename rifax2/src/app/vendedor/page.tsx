import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { getPortalVendedor } from "@/lib/portal-vendedor";
import { comisionVendedor } from "@/lib/comisiones";
import { money, fecha, estadoVentaClase } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const talClase: Record<string, string> = {
  asignado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  en_venta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  rendido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cerrado: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function VendedorHome() {
  const user = await requireUser();
  const portal = await getPortalVendedor(user.tenant.id, user.id);

  if (!portal) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Tu usuario aún no está vinculado a un registro de vendedor. Pide al administrador que cree
        tu acceso desde el módulo de Vendedores.
      </div>
    );
  }

  const { vendedor, ventas } = portal;
  const comision = await comisionVendedor(user.tenant.id, vendedor.id);
  const activos = vendedor.talonarios.filter((t) => t.estado !== "cerrado");
  const boletas = activos.reduce((a, t) => a + (t.numero_fin - t.numero_inicio + 1), 0);
  const recaudado = ventas.reduce((a, v) => a + (Number(v.total.toString()) - Number(v.saldo.toString())), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="inicio" /></span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hola, {vendedor.nombre.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{Number(vendedor.pct_comision.toString())}% comisión</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat v={String(activos.length)} l="Talonarios" />
        <Stat v={boletas.toLocaleString("es-CO")} l="Boletas" />
        <Stat v={money(recaudado)} l="Recaudado" />
      </div>

      <Link href="/app/ventas/nueva" className="block rounded-xl bg-[#f5c518] px-4 py-3.5 text-center text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition hover:bg-[#eab308]">
        + Registrar venta
      </Link>

      {comision ? (
        <Link href="/vendedor/comisiones" className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400">Comisión pendiente ({comision.pct}%)</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{money(comision.pendiente)}</p>
          </div>
          <span className="text-sm text-amber-700 dark:text-amber-400">Ver detalle →</span>
        </Link>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mis talonarios</h2>
        {activos.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin talonarios asignados.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {vendedor.talonarios.map((t) => (
              <div key={String(t.id)} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.rifas.codigo}</p>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{t.numero_inicio}–{t.numero_fin} · {(t.numero_fin - t.numero_inicio + 1).toLocaleString("es-CO")} boletas</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${talClase[t.estado] ?? talClase.cerrado}`}>{t.estado.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mis ventas recientes</h2>
        {ventas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aún no tienes ventas.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {ventas.map((v) => (
              <Link key={String(v.id)} href={`/app/ventas/${v.id}`} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{v.codigo}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{v.clientes.nombre} · {fecha(v.creado_en)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{money(v.total)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estadoVentaClase[v.estado] ?? estadoVentaClase.pendiente_pago}`}>{v.estado.replace("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-lg font-bold text-slate-900 dark:text-white">{v}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{l}</p>
    </div>
  );
}
