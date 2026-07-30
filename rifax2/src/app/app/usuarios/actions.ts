"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireUser } from "@/lib/auth/rbac";
import { crearUsuario, cambiarRol, cambiarEstado, cambiarPasswordPropia } from "@/lib/usuarios";

export interface UsuarioFormState {
  error?: string;
}

export async function crearUsuarioAction(_prev: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  const user = await requirePermission("usuario.crear");
  const telefono = String(formData.get("telefono") ?? "").trim();
  const sede = String(formData.get("sede_id") ?? "").trim();
  const permisos = formData.getAll("permisos").map((v) => String(v)).filter(Boolean);
  const res = await crearUsuario(
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      correo: String(formData.get("correo") ?? "").trim(),
      ...(telefono ? { telefono } : {}),
      password: String(formData.get("password") ?? ""),
      rol_id: String(formData.get("rol_id") ?? ""),
      ...(sede ? { sede_id: sede } : {}),
      ...(permisos.length > 0 ? { permisos } : {}),
    },
    user.tenant.id,
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/usuarios");
  redirect("/app/usuarios?creado=1");
}

export async function cambiarRolAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rol.gestionar");
  const res = await cambiarRol(BigInt(String(formData.get("usuario_id") ?? "0")), BigInt(String(formData.get("rol_id") ?? "0")), user.tenant.id, user.id);
  revalidatePath("/app/usuarios");
  redirect(res.ok ? "/app/usuarios?rol=1" : `/app/usuarios?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarEstadoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("usuario.editar");
  const res = await cambiarEstado(BigInt(String(formData.get("usuario_id") ?? "0")), String(formData.get("estado") ?? ""), user.tenant.id, user.id);
  revalidatePath("/app/usuarios");
  redirect(res.ok ? "/app/usuarios?estado=1" : `/app/usuarios?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarPasswordAction(_prev: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  const user = await requireUser();
  const res = await cambiarPasswordPropia(user.id, user.tenant.id, String(formData.get("actual") ?? ""), String(formData.get("nueva") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/login?password=cambiada");
}
