"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { procesarOutbox } from "@/lib/outbox";

export async function procesarOutboxAction(): Promise<void> {
  const user = await requirePermission("mensaje.enviar");
  const res = await procesarOutbox(user.tenant.id, 50);
  revalidatePath("/app/notificaciones");
  redirect(`/app/notificaciones?enviadas=${res.enviadas}&fallidas=${res.fallidas}`);
}
