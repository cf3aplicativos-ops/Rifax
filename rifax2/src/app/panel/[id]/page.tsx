import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { obtenerTenant } from "@/lib/superadmin";
import { PageTitle } from "@/components/icons";
import FormEditarTenant from "./form-editar";

export const dynamic = "force-dynamic";

export default async function EditarTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editado?: string; error?: string }>;
}) {
  await requireSuper();
  const { id } = await params;
  const sp = await searchParams;
  let tenantId: bigint;
  try {
    tenantId = BigInt(id);
  } catch {
    notFound();
  }

  const tenant = await obtenerTenant(tenantId);
  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a empresas</Link>
      <PageTitle icon="empresas" className="mt-2">Editar empresa</PageTitle>

      {sp.editado ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Empresa actualizada.</p>
      ) : null}
      {sp.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p>
      ) : null}

      <FormEditarTenant tenant={tenant} />
    </div>
  );
}
