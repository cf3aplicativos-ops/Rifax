"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requirePermission } from "@/lib/auth/rbac";
import { destroySession } from "@/lib/auth/session";
import { crearSede, cambiarEstadoSede } from "@/lib/sedes";

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
  const res = await crearSede(
    user.tenant.id,
    user.tenant.maxSedes,
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      direccion: String(formData.get("direccion") ?? "").trim() || undefined,
      telefono: String(formData.get("telefono") ?? "").trim() || undefined,
    },
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/sedes");
  redirect("/app/sedes?creada=1");
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
