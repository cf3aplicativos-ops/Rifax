import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarSedes } from "@/lib/sedes";
import { crearSedeAction, cambiarEstadoSedeAction } from "../actions";
import FormSede from "./form";

export const dynamic = "force-dynamic";

export default async function SedesPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; estado?: string; error?: string }>;
}) {
  const user = await requirePermission("sede.ver");
  const sp = await searchParams;
  const sedes = await listarSedes(user.tenant.id);

  const puedeCrear = hasPermission(user, "sede.crear");
  const puedeEditar = hasPermission(user, "sede.editar");
  const alcanzoLimite = sedes.length >= user.tenant.maxSedes;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sedes</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {sedes.length} de {user.tenant.maxSedes} sedes autorizadas
      </p>

      {sp.creada ? <Aviso tipo="ok">Sede creada.</Aviso> : null}
      {sp.estado ? <Aviso tipo="ok">Estado actualizado.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {sedes.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no hay sedes.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {sedes.map((s) => (
            <div
              key={String(s.id)}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-white">{s.nombre}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.estado === "activa"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {s.estado}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {s.direccion ?? "sin dirección"} · {s._count.rifas} rifas · {s._count.ventas} ventas
                </p>
              </div>
              {puedeEditar ? (
                <form action={cambiarEstadoSedeAction} className="flex items-center gap-1">
                  <input type="hidden" name="sede_id" value={String(s.id)} />
                  <select
                    name="estado"
                    defaultValue={s.estado}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="activa">activa</option>
                    <option value="inactiva">inactiva</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    ✓
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {puedeCrear ? (
        alcanzoLimite ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Alcanzaste el máximo de {user.tenant.maxSedes} sedes. Para abrir otra, solicita al
            super-admin de la plataforma ampliar el cupo.
          </p>
        ) : (
          <FormSede action={crearSedeAction} />
        )
      ) : null}
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase =
    tipo === "ok"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
