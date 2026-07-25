"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { destroySession } from "@/lib/auth/session";
import {
  crearTenant,
  cambiarEstadoTenant,
  cambiarMaxSedes,
  purgarTenant,
} from "@/lib/superadmin";

export interface TenantFormState {
  error?: string;
}

export async function logoutSuperAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function crearTenantAction(
  _prev: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const admin = await requireSuper();
  const res = await crearTenant(
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
      max_sedes: String(formData.get("max_sedes") ?? ""),
      admin_nombre: String(formData.get("admin_nombre") ?? "").trim(),
      admin_correo: String(formData.get("admin_correo") ?? "").trim(),
      admin_password: String(formData.get("admin_password") ?? ""),
    },
    admin.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/panel");
  redirect("/panel?creado=1");
}

export async function cambiarEstadoTenantAction(formData: FormData): Promise<void> {
  const admin = await requireSuper();
  const res = await cambiarEstadoTenant(
    BigInt(String(formData.get("tenant_id") ?? "0")),
    String(formData.get("estado") ?? ""),
    admin.id,
  );
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?estado=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarMaxSedesAction(formData: FormData): Promise<void> {
  const admin = await requireSuper();
  const res = await cambiarMaxSedes(
    BigInt(String(formData.get("tenant_id") ?? "0")),
    Number(formData.get("max_sedes")),
    admin.id,
  );
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?sedes=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}

export async function purgarTenantAction(formData: FormData): Promise<void> {
  await requireSuper();
  // Confirmación por texto: hay que escribir el slug exacto.
  const slug = String(formData.get("slug") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (slug !== confirm) {
    redirect(`/panel?error=${encodeURIComponent("La confirmación no coincide con el slug.")}`);
  }
  const res = await purgarTenant(BigInt(String(formData.get("tenant_id") ?? "0")));
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?purgado=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}
