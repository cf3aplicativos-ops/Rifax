import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { resumenOutbox, listarOutbox } from "@/lib/outbox";
import { fechaHora } from "@/lib/format";
import { procesarOutboxAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  procesando: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  enviado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  fallido: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ enviadas?: string; fallidas?: string }>;
}) {
  const user = await requirePermission("mensaje.enviar");
  const { enviadas, fallidas } = await searchParams;
  const [resumen, filas] = await Promise.all([resumenOutbox(), listarOutbox()]);

  const puedeEnviar = hasPermission(user, "mensaje.enviar");
  const pendientes = resumen.pendiente ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Notificaciones</h1>
        {puedeEnviar ? (
          <form action={procesarOutboxAction}>
            <button
              type="submit"
              disabled={pendientes === 0}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              Procesar pendientes ({pendientes})
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cola de salida (patrón outbox). Los eventos de negocio encolan aquí sus notificaciones.
      </p>

      {enviadas || fallidas ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Procesadas: {enviadas ?? 0} enviadas, {fallidas ?? 0} fallidas.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["pendiente", "procesando", "enviado", "fallido"] as const).map((e) => (
          <div
            key={e}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{resumen[e] ?? 0}</p>
            <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{e}</p>
          </div>
        ))}
      </div>

      {filas.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          La cola está vacía.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Intentos</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {filas.map((f) => (
                <tr key={String(f.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {f.evento}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{f.canal}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        estadoClase[f.estado] ?? estadoClase.pendiente
                      }`}
                    >
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {f.intentos}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {fechaHora(f.creado_en)}
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
