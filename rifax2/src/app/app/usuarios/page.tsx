import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarUsuarios, listarRoles } from "@/lib/usuarios";
import { fechaHora } from "@/lib/format";
import { cambiarRolAction, cambiarEstadoAction, restablecerUsuarioAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  inactivo: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  bloqueado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ creado?: string; rol?: string; estado?: string; pass?: string; error?: string }> }) {
  const user = await requirePermission("usuario.ver");
  const sp = await searchParams;
  const [usuarios, roles] = await Promise.all([listarUsuarios(user.tenant.id), listarRoles()]);
  const puedeCrear = hasPermission(user, "usuario.crear");
  const puedeEditar = hasPermission(user, "usuario.editar");
  const puedeRol = hasPermission(user, "rol.gestionar");

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageTitle icon="usuarios">Usuarios</PageTitle>
        {puedeCrear ? <Link href="/app/usuarios/nuevo" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">+ Nuevo usuario</Link> : null}
      </div>
      {sp.creado || sp.rol || sp.estado ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Cambio aplicado.</p> : null}
      {sp.pass ? (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">Contraseña temporal generada (se muestra una sola vez). Entrégala al usuario:</p>
          <p className="mt-2 select-all rounded-lg bg-white px-3 py-2 text-center font-mono text-lg font-bold text-slate-900 dark:bg-slate-900 dark:text-white">{sp.pass}</p>
        </div>
      ) : null}
      {sp.error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr><th className="px-4 py-3 font-medium">Usuario</th><th className="px-4 py-3 font-medium">Sede</th><th className="px-4 py-3 font-medium">Rol</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 font-medium">Último ingreso</th><th className="px-4 py-3 font-medium">Contraseña</th><th className="px-4 py-3 font-medium"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {usuarios.map((u) => {
              const esYo = u.id === user.id;
              return (
                <tr key={String(u.id)}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{u.nombre}{esYo ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">tú</span> : null}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{u.correo}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.sedes?.nombre ?? "Todas"}</td>
                  <td className="px-4 py-3">
                    {puedeRol && !esYo ? (
                      <form action={cambiarRolAction} className="flex items-center gap-1">
                        <input type="hidden" name="usuario_id" value={String(u.id)} />
                        <select name="rol_id" defaultValue={String(u.rol_id)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          {roles.map((r) => <option key={String(r.id)} value={String(r.id)}>{r.nombre}</option>)}
                        </select>
                        <button type="submit" aria-label="Guardar rol" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">✓</button>
                      </form>
                    ) : <span className="text-slate-700 dark:text-slate-300">{u.roles.nombre}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {puedeEditar && !esYo ? (
                      <form action={cambiarEstadoAction} className="flex items-center gap-1">
                        <input type="hidden" name="usuario_id" value={String(u.id)} />
                        <select name="estado" defaultValue={u.estado} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          <option value="activo">activo</option><option value="inactivo">inactivo</option><option value="bloqueado">bloqueado</option>
                        </select>
                        <button type="submit" aria-label="Guardar estado" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">✓</button>
                      </form>
                    ) : <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[u.estado] ?? estadoClase.inactivo}`}>{u.estado}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.ultimo_login ? fechaHora(u.ultimo_login) : "—"}</td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <form action={restablecerUsuarioAction}>
                        <input type="hidden" name="usuario_id" value={String(u.id)} />
                        <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Restablecer</button>
                      </form>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <Link href={`/app/usuarios/${String(u.id)}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Editar</Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
