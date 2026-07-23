import { requireUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const [rifas, ventas, clientes, boletas, usuarios, vendedores] = await Promise.all([
    prisma.rifas.count(),
    prisma.ventas.count(),
    prisma.clientes.count(),
    prisma.boletas.count(),
    prisma.usuarios.count(),
    prisma.vendedores.count(),
  ]);

  const stats = [
    { label: "Rifas", value: rifas },
    { label: "Ventas", value: ventas },
    { label: "Clientes", value: clientes },
    { label: "Boletas", value: boletas },
    { label: "Usuarios", value: usuarios },
    { label: "Vendedores", value: vendedores },
  ];

  return (
    <div>
      {denied ? (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          No tienes el permiso <code className="font-mono">{denied}</code> para esa sección.
        </p>
      ) : null}

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Hola, {user.nombre.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Rol <span className="font-medium">{user.rol}</span> · {user.permisos.length} permisos
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{s.value}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Tus permisos
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.permisos.map((p) => (
            <span
              key={p}
              className="rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {p}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
