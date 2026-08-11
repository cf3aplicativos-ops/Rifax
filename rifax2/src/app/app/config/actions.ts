"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { agregarItem, toggleItem } from "@/lib/catalogos";
import { guardarBranding } from "@/lib/branding";
import { guardarIntegraciones } from "@/lib/integraciones";

export async function guardarBrandingAction(formData: FormData): Promise<void> {
  const user = await requirePermission("config.gestionar");
  const logo = formData.get("logo");
  const fondo = formData.get("fondo");
  const res = await guardarBranding(
    user.tenant.id,
    {
      logo: logo instanceof File ? logo : null,
      fondo: fondo instanceof File ? fondo : null,
      color: String(formData.get("color") ?? "#f5c518"),
      quitarLogo: formData.get("quitar_logo") === "on",
      quitarFondo: formData.get("quitar_fondo") === "on",
    },
    user.id,
  );
  revalidatePath("/app", "layout");
  redirect(res.ok ? "/app/config?ok=1" : `/app/config?error=${encodeURIComponent(res.error)}`);
}

export async function guardarIntegracionesAction(formData: FormData): Promise<void> {
  const user = await requirePermission("config.gestionar");
  const res = await guardarIntegraciones(
    user.tenant.id,
    {
      wompi_sandbox: formData.get("wompi_sandbox") === "on",
      wompi_public_key: String(formData.get("wompi_public_key") ?? ""),
      wompi_private_key: String(formData.get("wompi_private_key") ?? ""),
      wompi_events_secret: String(formData.get("wompi_events_secret") ?? ""),
      whatsapp_phone_number_id: String(formData.get("whatsapp_phone_number_id") ?? ""),
      whatsapp_token: String(formData.get("whatsapp_token") ?? ""),
      sms_remitente: String(formData.get("sms_remitente") ?? ""),
      sms_api_key: String(formData.get("sms_api_key") ?? ""),
    },
    user.id,
  );
  revalidatePath("/app/config");
  redirect(res.ok ? "/app/config?ok=1#integraciones" : `/app/config?error=${encodeURIComponent(res.error)}#integraciones`);
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
