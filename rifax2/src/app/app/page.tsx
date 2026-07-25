import Link from "next/link";
import { requireUser, hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const sedes = await prisma.sedes.count({ where: { tenant_id: user.tenant.id } });

  return (
    <div>
      {denied ? (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          No tienes el permiso <code className="font-mono">{denied}</code> para esa sección.
        </p>
      ) : null}

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Hola, {user.nombre.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {user.tenant.nombre} · rol <span className="font-medium">{user.rol}</span> ·{" "}
        {user.permisos.length} permisos
      </p>

      {sedes === 0 && hasPermission(user, "sede.crear") ? (
        <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
          <h2 className="font-semibold text-indigo-900 dark:text-indigo-200">Empieza creando una sede</h2>
          <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">
            Tu empresa tiene {user.tenant.maxSedes} sede(s) autorizada(s). Crea la primera para
            comenzar a operar.
          </p>
          <Link
            href="/app/sedes"
            className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Gestionar sedes →
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {sedes}<span className="text-lg text-slate-400">/{user.tenant.maxSedes}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sedes</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Módulos de negocio
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Rifas, ventas, cartera, vendedores y sorteos se están migrando al modelo multi-empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
