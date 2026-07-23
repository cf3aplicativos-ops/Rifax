import { requirePermission } from "@/lib/auth/rbac";

export default async function CarteraPage() {
  await requirePermission("cartera.ver");
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Cartera</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Módulo en construcción.
      </p>
    </div>
  );
}
