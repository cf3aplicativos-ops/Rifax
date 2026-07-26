import { requireUser } from "@/lib/auth/rbac";
import FormPassword from "./form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mi perfil</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Dato k="Nombre" v={user.nombre} />
          <Dato k="Correo" v={user.correo} />
          <Dato k="Empresa" v={user.tenant.nombre} />
          <Dato k="Rol" v={user.rol} />
          <Dato k="Sede" v={user.sede?.nombre ?? "Todas"} />
          <Dato k="Permisos" v={String(user.permisos.length)} />
        </dl>
      </div>
      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-white">Cambiar contraseña</h2>
      <FormPassword />
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{v}</dd>
    </div>
  );
}
