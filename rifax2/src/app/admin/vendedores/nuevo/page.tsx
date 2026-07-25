import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import FormVendedor from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoVendedorPage() {
  await requirePermission("vendedor.crear");

  return (
    <div className="max-w-xl">
      <Link
        href="/admin/vendedores"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a vendedores
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nuevo vendedor</h1>
      <FormVendedor />
    </div>
  );
}
