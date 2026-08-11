import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { obtenerUsuario, permisosYRoles } from "@/lib/usuarios";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/icons";
import FormEditarUsuario from "./form-editar";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editado?: string; error?: string }>;
}) {
  const user = await requirePermission("usuario.editar");
  const { id } = await params;
  const sp = await searchParams;
  let usuarioId: bigint;
  try { usuarioId = BigInt(id); } catch { notFound(); }

  const [usuario, { permisos, roles }, sedes] = await Promise.all([
    obtenerUsuario(user.tenant.id, usuarioId),
    permisosYRoles(),
    prisma.sedes.findMany({ where: { tenant_id: user.tenant.id, estado: "activa" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  if (!usuario) notFound();

  return (
    <div>
      <Link href="/app/usuarios" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a usuarios</Link>
      <PageTitle icon="usuarios" className="mt-2">Editar usuario</PageTitle>

      {sp.editado ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Usuario actualizado.</p>
      ) : null}
      {sp.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p>
      ) : null}

      <FormEditarUsuario
        usuario={{
          id: String(usuario.id),
          nombre: usuario.nombre,
          correo: usuario.correo,
          telefono: usuario.telefono ?? "",
          rolId: String(usuario.rol_id),
          sedeId: usuario.sede_id ? String(usuario.sede_id) : "",
          permisosPersonalizados: usuario.permisosPersonalizados,
          esUnoMismo: usuario.id === user.id,
        }}
        roles={roles}
        permisos={permisos}
        sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))}
      />
    </div>
  );
}
