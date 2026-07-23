import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { listarUsuarios, listarRoles } from "@/lib/usuarios";
import { fechaHora } from "@/lib/format";
import { cambiarRolAction, cambiarEstadoAction } from "./actions";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activo: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  inactivo: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  bloqueado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; rol?: string; estado?: string; error?: string }>;
}) {
  const user = await requirePermission("usuario.ver");
  const { creado, rol, estado, error } = await searchParams;
  const [usuarios, roles] = await Promise.all([listarUsuarios(), listarRoles()]);

  const puedeCrear = hasPermission(user, "usuario.crear");
  const puedeEditar = hasPermission(user, "usuario.editar");
  const puedeRol = hasPermission(user, "rol.gestionar");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Usuarios</h1>
        {puedeCrear ? (
          <Link
            href="/admin/usuarios/nuevo"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Nuevo usuario
          </Link>
        ) : null}
      </div>

      {creado || rol || estado ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Cambio aplicado correctamente.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Último ingreso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {usuarios.map((u) => {
              const esYo = u.id === user.id;
              return (
                <tr key={String(u.id)}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {u.nombre}
                      {esYo ? (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          tú
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {u.correo}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {puedeRol && !esYo ? (
                      <form action={cambiarRolAction} className="flex items-center gap-1">
                        <input type="hidden" name="usuario_id" value={String(u.id)} />
                        <select
                          name="rol_id"
                          defaultValue={String(u.rol_id)}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          {roles.map((r) => (
                            <option key={String(r.id)} value={String(r.id)}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300">{u.roles.nombre}</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {puedeEditar && !esYo ? (
                      <form action={cambiarEstadoAction} className="flex items-center gap-1">
                        <input type="hidden" name="usuario_id" value={String(u.id)} />
                        <select
                          name="estado"
                          defaultValue={u.estado}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          <option value="activo">activo</option>
                          <option value="inactivo">inactivo</option>
                          <option value="bloqueado">bloqueado</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          estadoClase[u.estado] ?? estadoClase.inactivo
                        }`}
                      >
                        {u.estado}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {u.ultimo_login ? fechaHora(u.ultimo_login) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Roles</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {roles.map((r) => (
            <div
              key={String(r.id)}
              className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{r.nombre}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {r._count.roles_permisos} permisos · {r._count.usuarios} usuario
                {r._count.usuarios === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
