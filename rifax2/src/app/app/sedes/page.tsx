import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarSedes } from "@/lib/sedes";
import { crearSedeAction, cambiarEstadoSedeAction, editarSedeAction } from "../actions";
import FormSede from "./form";

export const dynamic = "force-dynamic";

export default async function SedesPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; admin?: string; estado?: string; editada?: string; error?: string }>;
}) {
  const user = await requirePermission("sede.ver");
  const sp = await searchParams;
  const sedes = await listarSedes(user.tenant.id);

  const puedeCrear = hasPermission(user, "sede.crear");
  const puedeEditar = hasPermission(user, "sede.editar");
  const alcanzoLimite = sedes.length >= user.tenant.maxSedes;

  return (
    <div>
      <PageTitle icon="sedes">Sedes</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {sedes.length} de {user.tenant.maxSedes} sedes autorizadas
      </p>

      {sp.creada ? <Aviso tipo="ok">Sede creada.{sp.admin ? " Su administrador también quedó creado (deberá cambiar su contraseña al ingresar por primera vez)." : ""}</Aviso> : null}
      {sp.estado ? <Aviso tipo="ok">Estado actualizado.</Aviso> : null}
      {sp.editada ? <Aviso tipo="ok">Sede actualizada.</Aviso> : null}
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
              className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/sedes/${s.id}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{s.nombre}</Link>
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
                  <Link href={`/app/sedes/${s.id}`} className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ver radiografía →</Link>
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
                      aria-label="Guardar estado"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      ✓
                    </button>
                  </form>
                ) : null}
              </div>

              {puedeEditar ? (
                <details className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <summary className="cursor-pointer select-none text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">✏️ Editar sede</summary>
                  <form action={editarSedeAction} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input type="hidden" name="sede_id" value={String(s.id)} />
                    <input name="nombre" defaultValue={s.nombre} required minLength={2} placeholder="Nombre" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    <input name="direccion" defaultValue={s.direccion ?? ""} placeholder="Dirección" className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    <div className="flex gap-2">
                      <input name="telefono" defaultValue={s.telefono ?? ""} placeholder="Teléfono" className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                      <button type="submit" className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">Guardar</button>
                    </div>
                  </form>
                  {s.usuarios.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Administrador de esta sede: {s.usuarios[0].nombre} ·{" "}
                      <Link href={`/app/usuarios/${s.usuarios[0].id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        gestionar sus credenciales →
                      </Link>
                    </p>
                  ) : null}
                </details>
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
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
