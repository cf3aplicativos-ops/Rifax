import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requireSuper } from "@/lib/auth/rbac";
import { estadoAuditoriaGlobal, historialPurgasAuditoria } from "@/lib/superadmin";
import { fechaHora } from "@/lib/format";
import PurgarWizard from "./purgar-wizard";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ purgado?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const [estado, historial] = await Promise.all([estadoAuditoriaGlobal(), historialPurgasAuditoria()]);

  const limite = new Date();
  limite.setDate(limite.getDate() - 365);
  const limiteMaximo = limite.toISOString().slice(0, 10);

  return (
    <div>
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver</Link>
      <PageTitle icon="reportes" className="mt-2">Auditoría de la plataforma</PageTitle>
      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        El historial de auditoría es una cadena de hashes compartida por toda la plataforma: cada evento incluye
        el hash del anterior, así que cualquier alteración se puede detectar. Solo se puede purgar historial de
        hace más de un año, y cada purga queda registrada (qué se borró, cuándo y quién lo hizo).
      </p>

      {sp.purgado ? <Aviso tipo="ok">Se purgaron {sp.purgado} registro{sp.purgado === "1" ? "" : "s"} de auditoría.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Kpi v={estado.totalEventos.toLocaleString("es-CO")} l="Eventos totales" />
        <Kpi
          v={estado.integra ? "Íntegra" : `Rota en #${estado.rotaEnId}`}
          l="Estado de la cadena"
          tono={estado.integra ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
        />
        <Kpi v={estado.ultimaPurga ? fechaHora(estado.ultimaPurga.fecha) : "Nunca"} l="Última purga" />
        <Kpi v={String(estado.totalReinicios)} l="Reinicios documentados (purgas + tenants eliminados)" />
      </div>

      <div className="mt-6">
        <PurgarWizard limiteMaximo={limiteMaximo} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-white">Historial de purgas</h2>
      {historial.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Todavía no se ha purgado nada.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Purgado hasta</th>
                <th className="px-4 py-2 text-right font-medium">Filas borradas</th>
                <th className="px-4 py-2 font-medium">Realizado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {historial.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{fechaHora(h.creadoEn)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{fechaHora(h.purgadoHasta)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{h.filasBorradas.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{h.actorNombre ?? "—"}</td>
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
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className={`text-xl font-bold ${tono ?? "text-slate-900 dark:text-white"}`}>{v}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l}</p>
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase =
    tipo === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
