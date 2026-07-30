"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { liquidarVendedor, liquidarMasivo } from "@/lib/comisiones";

export async function liquidarVendedorAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pago.conciliar");
  const res = await liquidarVendedor(user.tenant.id, BigInt(String(formData.get("vendedor_id") ?? "0")), user.id);
  revalidatePath("/app/comisiones");
  redirect(res.ok ? "/app/comisiones?liquidado=1" : `/app/comisiones?error=${encodeURIComponent(res.error)}`);
}

export async function liquidarMasivoAction(): Promise<void> {
  const user = await requirePermission("pago.conciliar");
  const res = await liquidarMasivo(user.tenant.id, user.id);
  revalidatePath("/app/comisiones");
  redirect(res.ok ? `/app/comisiones?masivo=${res.data?.vendedores}` : `/app/comisiones?error=${encodeURIComponent(res.error)}`);
}
