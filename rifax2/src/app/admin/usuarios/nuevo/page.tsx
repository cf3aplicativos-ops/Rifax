import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listarRoles } from "@/lib/usuarios";
import FormUsuario from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoUsuarioPage() {
  await requirePermission("usuario.crear");
  const roles = await listarRoles();

  return (
    <div className="max-w-xl">
      <Link
        href="/admin/usuarios"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a usuarios
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nuevo usuario</h1>

      <FormUsuario
        roles={roles.map((r) => ({
          id: String(r.id),
          nombre: r.nombre,
          descripcion: r.descripcion,
          permisos: r._count.roles_permisos,
        }))}
      />
    </div>
  );
}
