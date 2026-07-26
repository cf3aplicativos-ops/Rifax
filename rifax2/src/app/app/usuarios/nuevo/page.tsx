import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listarRoles } from "@/lib/usuarios";
import { prisma } from "@/lib/prisma";
import FormUsuario from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoUsuarioPage() {
  const user = await requirePermission("usuario.crear");
  const [roles, sedes] = await Promise.all([
    listarRoles(),
    prisma.sedes.findMany({ where: { tenant_id: user.tenant.id, estado: "activa" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <div className="max-w-xl">
      <Link href="/app/usuarios" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a usuarios</Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Nuevo usuario</h1>
      <FormUsuario
        roles={roles.map((r) => ({ id: String(r.id), nombre: r.nombre, permisos: r._count.roles_permisos }))}
        sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))}
      />
    </div>
  );
}
