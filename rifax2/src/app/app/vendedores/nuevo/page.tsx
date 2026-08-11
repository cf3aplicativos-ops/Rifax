import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import FormVendedor from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoVendedorPage() {
  const user = await requirePermission("vendedor.crear");
  const sedes = await prisma.sedes.findMany({
    where: { tenant_id: user.tenant.id, estado: "activa", ...(user.sede ? { id: user.sede.id } : {}) },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  return (
    <div>
      <Link href="/app/vendedores" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a vendedores</Link>
      <PageTitle icon="nuevo" className="mt-2">Nuevo vendedor</PageTitle>
      <FormVendedor sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))} />
    </div>
  );
}
