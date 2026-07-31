"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { restablecerPorCorreo } from "@/lib/reset-password";

export async function restablecerPorCorreoAction(formData: FormData): Promise<void> {
  await requireSuper();
  const correo = String(formData.get("correo") ?? "").trim();
  const res = await restablecerPorCorreo(correo);
  revalidatePath("/panel/restablecer");
  if (!res.ok) redirect(`/panel/restablecer?error=${encodeURIComponent(res.error)}`);
  // La contraseña temporal se muestra una vez en la URL de retorno.
  redirect(`/panel/restablecer?ok=1&pass=${encodeURIComponent(res.data!.password)}&quien=${encodeURIComponent(res.data!.quien)}`);
}
