import Link from "next/link";
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
    <div className="max-w-xl">
      <Link href="/app/vendedores" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a vendedores</Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Nuevo vendedor</h1>
      <FormVendedor sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))} />
    </div>
  );
}
