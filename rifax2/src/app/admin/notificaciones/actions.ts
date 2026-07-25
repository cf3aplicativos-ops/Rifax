"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { procesarOutbox } from "@/lib/outbox";

export async function procesarOutboxAction(): Promise<void> {
  await requirePermission("mensaje.enviar");
  const res = await procesarOutbox(50);
  revalidatePath("/admin/notificaciones");
  redirect(`/admin/notificaciones?enviadas=${res.enviadas}&fallidas=${res.fallidas}`);
}
