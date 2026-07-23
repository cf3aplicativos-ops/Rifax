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

  const raw = Object.fromEntries(formData) as Record<string, string>;
  // Los opcionales vacíos deben quedar `undefined`, no "" (que zod coercería a 0).
  const input: Record<string, string> = { ...raw };
  if (!input.descripcion) delete input.descripcion;
  if (!input.tasa_derechos) delete input.tasa_derechos;

  const res = await crearRifa(input, user.id);
  if (!res.ok) return { error: res.error };

  revalidatePath("/admin/rifas");
  redirect("/admin/rifas");
}

export async function publicarRifaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.publicar");
  const id = BigInt(String(formData.get("id") ?? "0"));

  const res = await publicarRifa(id, user.id);
  revalidatePath("/admin/rifas");

  redirect(
    res.ok
      ? `/admin/rifas?publicada=${res.boletas}`
      : `/admin/rifas?error=${encodeURIComponent(res.error)}`,
  );
}
