import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { permisosYRoles } from "@/lib/usuarios";
import { prisma } from "@/lib/prisma";
import FormUsuario from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoUsuarioPage() {
  const user = await requirePermission("usuario.crear");
  const [{ permisos, roles }, sedes] = await Promise.all([
    permisosYRoles(),
    prisma.sedes.findMany({ where: { tenant_id: user.tenant.id, estado: "activa" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <div>
      <Link href="/app/usuarios" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a usuarios</Link>
      <PageTitle icon="nuevo" className="mt-2">Nuevo usuario</PageTitle>
      <FormUsuario
        roles={roles}
        permisos={permisos}
        sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))}
      />
    </div>
  );
}
