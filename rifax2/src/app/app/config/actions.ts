"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { agregarItem, toggleItem } from "@/lib/catalogos";
import { guardarBranding } from "@/lib/branding";

export async function guardarBrandingAction(formData: FormData): Promise<void> {
  const user = await requirePermission("config.gestionar");
  const logo = formData.get("logo");
  const fondo = formData.get("fondo");
  const res = await guardarBranding(
    user.tenant.id,
    {
      logo: logo instanceof File ? logo : null,
      fondo: fondo instanceof File ? fondo : null,
      color: String(formData.get("color") ?? "#4f46e5"),
      quitarLogo: formData.get("quitar_logo") === "on",
      quitarFondo: formData.get("quitar_fondo") === "on",
    },
    user.id,
  );
  revalidatePath("/app", "layout");
  redirect(res.ok ? "/app/config?ok=1" : `/app/config?error=${encodeURIComponent(res.error)}`);
}

export async function agregarItemAction(formData: FormData): Promise<void> {
  const user = await requirePermission("config.gestionar");
  const res = await agregarItem(
    user.tenant.id,
    String(formData.get("tipo") ?? ""),
    String(formData.get("valor") ?? ""),
    String(formData.get("etiqueta") ?? ""),
    user.id,
  );
  revalidatePath("/app/config");
  redirect(res.ok ? "/app/config?ok=1" : `/app/config?error=${encodeURIComponent(res.error)}`);
}

export async function toggleItemAction(formData: FormData): Promise<void> {
  const user = await requirePermission("config.gestionar");
  const res = await toggleItem(user.tenant.id, BigInt(String(formData.get("id") ?? "0")), user.id);
  revalidatePath("/app/config");
  redirect(res.ok ? "/app/config?ok=1" : `/app/config?error=${encodeURIComponent(res.error)}`);
}
