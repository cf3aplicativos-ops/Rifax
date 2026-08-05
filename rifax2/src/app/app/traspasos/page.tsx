import { redirect } from "next/navigation";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { contextoDeUsuario, listarSolicitudesRecibidas, listarSolicitudesRecibidasTenant, listarSolicitudesEnviadas, type SolicitudFila } from "@/lib/traspasos";
import { fechaHora } from "@/lib/format";
import { resolverSolicitudAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  aprobada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rechazada: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function TraspasosPage({
  searchParams,
}: {
  searchParams: Promise<{ resuelto?: string; error?: string }>;
}) {
  const user = await requirePermission("boleta.traspasar");
  // El vendedor gestiona sus solicitudes desde su propio portal.
  if (user.rol === "vendedor") redirect("/vendedor/traspasos");
  const sp = await searchParams;

  const contexto = await contextoDeUsuario(user.tenant.id, user);
  const [recibidas, enviadas] = await Promise.all([
    contexto ? listarSolicitudesRecibidas(user.tenant.id, contexto) : listarSolicitudesRecibidasTenant(user.tenant.id),
    contexto ? listarSolicitudesEnviadas(user.tenant.id, contexto) : Promise.resolve<SolicitudFila[]>([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle icon="traspaso">Traspasos de boletas</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Solicitudes de vendedores u otras sedes para tomar boletas de tu punto de venta, y el estado de tus propias solicitudes.
      </p>

      {sp.resuelto ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Solicitud resuelta.</p> : null}
      {sp.error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p> : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recibidas ({recibidas.filter((s) => s.estado === "pendiente").length} pendientes)</h2>
        {recibidas.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Sin solicitudes recibidas.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recibidas.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Boleta <span className="font-mono">#{s.numero}</span> · {s.rifa}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Solicitada por: {s.solicitante} · {fechaHora(s.creadoEn)}</p>
                    {s.motivoRechazo ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motivo: {s.motivoRechazo}</p> : null}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoClase[s.estado] ?? ""}`}>{s.estado}</span>
                </div>
                {s.estado === "pendiente" ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <form action={resolverSolicitudAction}>
                      <input type="hidden" name="solicitud_id" value={s.id} />
                      <input type="hidden" name="accion" value="aprobar" />
                      <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">Autorizar</button>
                    </form>
                    <form action={resolverSolicitudAction} className="flex items-end gap-2">
                      <input type="hidden" name="solicitud_id" value={s.id} />
                      <input type="hidden" name="accion" value="rechazar" />
                      <input name="motivo" placeholder="Motivo (opcional)" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                      <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Rechazar</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {contexto ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enviadas por mí</h2>
          {enviadas.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No has enviado solicitudes.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {enviadas.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Boleta <span className="font-mono">#{s.numero}</span> · {s.rifa}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">A: {s.propietario} · {fechaHora(s.creadoEn)}</p>
                    {s.motivoRechazo ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motivo del rechazo: {s.motivoRechazo}</p> : null}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoClase[s.estado] ?? ""}`}>{s.estado}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
