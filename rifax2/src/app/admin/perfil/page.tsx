import { requireUser } from "@/lib/auth/rbac";
import FormPassword from "./form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Mi perfil</h1>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Nombre</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{user.nombre}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Correo</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{user.correo}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Rol</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{user.rol}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Permisos</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
              {user.permisos.length}
            </dd>
          </div>
        </dl>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Cambiar contraseña
      </h2>
      <FormPassword />
    </div>
  );
}
