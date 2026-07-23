"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireUser } from "@/lib/auth/rbac";
import {
  crearUsuario,
  cambiarRol,
  cambiarEstado,
  cambiarPasswordPropia,
} from "@/lib/usuarios";

export interface UsuarioFormState {
  error?: string;
  ok?: boolean;
}

export async function crearUsuarioAction(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const user = await requirePermission("usuario.crear");

  const telefono = String(formData.get("telefono") ?? "").trim();
  const res = await crearUsuario(
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      correo: String(formData.get("correo") ?? "").trim(),
      ...(telefono ? { telefono } : {}),
      password: String(formData.get("password") ?? ""),
      rol_id: String(formData.get("rol_id") ?? ""),
    },
    user.id,
  );
  if (!res.ok) return { error: res.error };

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?creado=1");
}

export async function cambiarRolAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rol.gestionar");
  const res = await cambiarRol(
    BigInt(String(formData.get("usuario_id") ?? "0")),
    BigInt(String(formData.get("rol_id") ?? "0")),
    user.id,
  );
  revalidatePath("/admin/usuarios");
  redirect(res.ok ? "/admin/usuarios?rol=1" : `/admin/usuarios?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarEstadoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("usuario.editar");
  const res = await cambiarEstado(
    BigInt(String(formData.get("usuario_id") ?? "0")),
    String(formData.get("estado") ?? ""),
    user.id,
  );
  revalidatePath("/admin/usuarios");
  redirect(
    res.ok ? "/admin/usuarios?estado=1" : `/admin/usuarios?error=${encodeURIComponent(res.error)}`,
  );
}

export async function cambiarPasswordAction(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const user = await requireUser();
  const res = await cambiarPasswordPropia(
    user.id,
    String(formData.get("actual") ?? ""),
    String(formData.get("nueva") ?? ""),
  );
  if (!res.ok) return { error: res.error };

  // Al cambiar la contraseña se revocan todas las sesiones, incluida la actual:
  // hay que volver a entrar.
  redirect("/login?password=cambiada");
}
