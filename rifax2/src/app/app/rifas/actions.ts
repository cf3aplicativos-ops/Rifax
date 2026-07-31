"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { crearRifa, publicarRifa } from "@/lib/rifas";

export interface RifaFormState {
  error?: string;
}

export async function crearRifaAction(
  _prev: RifaFormState,
  formData: FormData,
): Promise<RifaFormState> {
  const user = await requirePermission("rifa.crear");
  const input = {
    sede_id: String(formData.get("sede_id") ?? ""),
    nombre: String(formData.get("nombre") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "").trim() || undefined,
    loteria: String(formData.get("loteria") ?? "") || undefined,
    numero_digitos: String(formData.get("numero_digitos") ?? "3"),
    precio_boleta: String(formData.get("precio_boleta") ?? ""),
    fecha_apertura: String(formData.get("fecha_apertura") ?? ""),
    fecha_cierre_ventas: String(formData.get("fecha_cierre_ventas") ?? ""),
    fecha_sorteo: String(formData.get("fecha_sorteo") ?? ""),
    tasa_derechos: String(formData.get("tasa_derechos") ?? "") || undefined,
    compartida: formData.get("compartida") === "on",
  };
  const res = await crearRifa(input, user.tenant.id, user.sede?.id ?? null, user.id);
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/rifas");
  redirect("/app/rifas");
}

export async function publicarRifaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.publicar");
  const res = await publicarRifa(user.tenant.id, BigInt(String(formData.get("id") ?? "0")), user.id);
  revalidatePath("/app/rifas");
  redirect(
    res.ok
      ? `/app/rifas?publicada=${res.boletas}`
      : `/app/rifas?error=${encodeURIComponent(res.error)}`,
  );
}
