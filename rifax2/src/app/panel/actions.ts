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
import { cambiarPlanTenant } from "@/lib/plataforma";
import { registrarPagoVencimiento, regenerarVencimientos } from "@/lib/vencimientos";

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
  const usuariosIlim = formData.get("usuarios_ilimitados") === "on";
  const res = await crearTenant(
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
      plan: String(formData.get("plan") ?? "basico"),
      sedes_ilimitadas: formData.get("sedes_ilimitadas") === "on",
      max_sedes: String(formData.get("max_sedes") ?? "1"),
      usuarios_ilimitados: usuariosIlim,
      ...(usuariosIlim ? {} : { max_usuarios: String(formData.get("max_usuarios") ?? "5") }),
      periodicidad: String(formData.get("periodicidad") ?? "mensual"),
      periodicidad_pago: String(formData.get("periodicidad_pago") ?? "mensual"),
      fecha_inicio: String(formData.get("fecha_inicio") ?? ""),
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

export async function cambiarPlanTenantAction(formData: FormData): Promise<void> {
  const admin = await requireSuper();
  const res = await cambiarPlanTenant(
    BigInt(String(formData.get("tenant_id") ?? "0")),
    String(formData.get("plan") ?? ""),
    admin.id,
  );
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?plan=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}

export async function registrarPagoVencimientoAction(formData: FormData): Promise<void> {
  await requireSuper();
  await registrarPagoVencimiento(BigInt(String(formData.get("vencimiento_id") ?? "0")));
  revalidatePath("/panel");
  redirect("/panel?pago=1");
}

export async function regenerarVencimientosAction(formData: FormData): Promise<void> {
  await requireSuper();
  const res = await regenerarVencimientos(BigInt(String(formData.get("tenant_id") ?? "0")));
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?calendario=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}

// Borrado de la base de datos del cliente con verificación en TRES pasos:
//  1) aceptar que es irreversible, 2) escribir el slug exacto,
//  3) escribir la palabra ELIMINAR. El servidor revalida los tres.
export async function purgarTenantAction(formData: FormData): Promise<void> {
  await requireSuper();
  const slug = String(formData.get("slug") ?? "");
  const confirmSlug = String(formData.get("confirm_slug") ?? "");
  const frase = String(formData.get("confirm_frase") ?? "").trim().toUpperCase();
  const acepta = formData.get("acepta") === "on";

  if (!acepta) {
    redirect(`/panel?error=${encodeURIComponent("Paso 1: debes aceptar que la acción es irreversible.")}`);
  }
  if (slug !== confirmSlug) {
    redirect(`/panel?error=${encodeURIComponent("Paso 2: el identificador (slug) no coincide.")}`);
  }
  if (frase !== "ELIMINAR") {
    redirect(`/panel?error=${encodeURIComponent("Paso 3: escribe la palabra ELIMINAR para confirmar.")}`);
  }
  const res = await purgarTenant(BigInt(String(formData.get("tenant_id") ?? "0")));
  revalidatePath("/panel");
  redirect(res.ok ? "/panel?purgado=1" : `/panel?error=${encodeURIComponent(res.error)}`);
}
