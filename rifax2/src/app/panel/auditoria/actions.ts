"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { purgarAuditoria } from "@/lib/superadmin";

// Purga del historial de auditoría con verificación en DOS pasos: aceptar que
// es irreversible, y escribir la palabra PURGAR. El servidor revalida ambos
// (los valores viajan como hidden, igual que en purgarTenantAction).
export async function purgarAuditoriaAction(formData: FormData): Promise<void> {
  const admin = await requireSuper();
  const acepta = formData.get("acepta") === "on";
  const frase = String(formData.get("confirm_frase") ?? "").trim().toUpperCase();
  const hastaStr = String(formData.get("hasta") ?? "");

  if (!acepta) {
    redirect(`/panel/auditoria?error=${encodeURIComponent("Paso 1: debes aceptar que la acción es irreversible.")}`);
  }
  if (frase !== "PURGAR") {
    redirect(`/panel/auditoria?error=${encodeURIComponent("Paso 2: escribe la palabra PURGAR para confirmar.")}`);
  }

  const hasta = new Date(hastaStr);
  const res = await purgarAuditoria(hasta, admin.id);
  revalidatePath("/panel/auditoria");
  redirect(res.ok ? `/panel/auditoria?purgado=${res.data!.filasBorradas}` : `/panel/auditoria?error=${encodeURIComponent(res.error)}`);
}
