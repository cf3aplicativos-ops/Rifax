"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { destroySession } from "@/lib/auth/session";
import { crearSede, cambiarEstadoSede, editarSede } from "@/lib/sedes";

export interface SedeFormState {
  error?: string;
}

export async function logoutUserAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function crearSedeAction(
  _prev: SedeFormState,
  formData: FormData,
): Promise<SedeFormState> {
  const user = await requirePermission("sede.crear");
  const adminCorreo = String(formData.get("admin_correo") ?? "").trim();
  const res = await crearSede(
    user.tenant.id,
    user.tenant.maxSedes,
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      direccion: String(formData.get("direccion") ?? "").trim() || undefined,
      telefono: String(formData.get("telefono") ?? "").trim() || undefined,
      ...(adminCorreo
        ? {
            admin_nombre: String(formData.get("admin_nombre") ?? "").trim(),
            admin_correo: adminCorreo,
            admin_password: String(formData.get("admin_password") ?? ""),
          }
        : {}),
    },
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/sedes");
  revalidatePath("/app/usuarios");
  redirect(`/app/sedes?creada=1${res.data?.adminId ? "&admin=1" : ""}`);
}

export async function editarSedeAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sede.editar");
  const res = await editarSede(
    BigInt(String(formData.get("sede_id") ?? "0")),
    user.tenant.id,
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      direccion: String(formData.get("direccion") ?? "").trim() || undefined,
      telefono: String(formData.get("telefono") ?? "").trim() || undefined,
    },
    user.id,
  );
  revalidatePath("/app/sedes");
  redirect(res.ok ? "/app/sedes?editada=1" : `/app/sedes?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarEstadoSedeAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sede.editar");
  const res = await cambiarEstadoSede(
    BigInt(String(formData.get("sede_id") ?? "0")),
    user.tenant.id,
    String(formData.get("estado") ?? ""),
    user.id,
  );
  revalidatePath("/app/sedes");
  redirect(res.ok ? "/app/sedes?estado=1" : `/app/sedes?error=${encodeURIComponent(res.error)}`);
}
