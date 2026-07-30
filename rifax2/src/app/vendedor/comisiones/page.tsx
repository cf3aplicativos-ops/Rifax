import { requireUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { comisionVendedor } from "@/lib/comisiones";
import { money } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ComisionesVendedor() {
  const user = await requireUser();
  const vendedor = await prisma.vendedores.findFirst({ where: { tenant_id: user.tenant.id, usuario_id: user.id }, select: { id: true } });
  const c = vendedor ? await comisionVendedor(user.tenant.id, vendedor.id) : null;

  if (!c) {
    return <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Tu usuario no está vinculado a un vendedor.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="comisiones" /></span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mis comisiones</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">Ganas el {c.pct}% de lo que recaudas.</p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs uppercase text-slate-400">Pendiente por cobrar</p>
        <p className="mt-1 text-4xl font-extrabold text-amber-600 dark:text-amber-400">{money(c.pendiente)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Fila k="Recaudado" v={money(c.recaudado)} />
        <Fila k="Comisión ganada" v={money(c.comisionGanada)} />
        <Fila k="Ya liquidado" v={money(c.liquidado)} tono="text-emerald-600 dark:text-emerald-400" />
        <Fila k="Pendiente" v={money(c.pendiente)} tono="text-amber-600 dark:text-amber-400" />
      </div>

      <p className="text-center text-xs text-slate-400">La liquidación de tus comisiones la realiza la administración.</p>
    </div>
  );
}

function Fila({ k, v, tono }: { k: string; v: string; tono?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-slate-500 dark:text-slate-400">{k}</span>
      <span className={`font-semibold ${tono ?? "text-slate-900 dark:text-slate-100"}`}>{v}</span>
    </div>
  );
}
