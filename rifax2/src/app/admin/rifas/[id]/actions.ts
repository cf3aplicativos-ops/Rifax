"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { agregarPremio } from "@/lib/rifas";
import { ejecutarSorteo, cambiarEntregaGanador } from "@/lib/sorteos";

export async function agregarPremioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const valor = String(formData.get("valor_estimado") ?? "").trim();

  const res = await agregarPremio(
    BigInt(rifaId),
    { nombre: String(formData.get("nombre") ?? ""), valorEstimado: valor ? Number(valor) : null },
    user.id,
  );
  revalidatePath(`/admin/rifas/${rifaId}`);
  redirect(res.ok ? `/admin/rifas/${rifaId}?premio=1` : `/admin/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function ejecutarSorteoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sorteo.ejecutar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const modalidad = String(formData.get("modalidad") ?? "commit_reveal") as
    | "externo"
    | "commit_reveal";
  const numeroRaw = String(formData.get("numero_ganador") ?? "").trim();
  const evidencia = String(formData.get("evidencia_url") ?? "").trim();

  const res = await ejecutarSorteo(
    {
      rifaId: BigInt(rifaId),
      premioId: BigInt(String(formData.get("premio_id") ?? "0")),
      modalidad,
      ...(numeroRaw ? { numeroGanador: Number(numeroRaw) } : {}),
      ...(evidencia ? { evidenciaUrl: evidencia } : {}),
    },
    user.id,
  );
  revalidatePath(`/admin/rifas/${rifaId}`);
  redirect(
    res.ok
      ? `/admin/rifas/${rifaId}?sorteo=${res.data?.numeroGanador}&ganador=${res.data?.conGanador ? 1 : 0}`
      : `/admin/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`,
  );
}

export async function cambiarEntregaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sorteo.ejecutar");
  const rifaId = String(formData.get("rifa_id") ?? "0");

  const res = await cambiarEntregaGanador(
    BigInt(String(formData.get("ganador_id") ?? "0")),
    String(formData.get("estado") ?? ""),
    user.id,
  );
  revalidatePath(`/admin/rifas/${rifaId}`);
  redirect(
    res.ok ? `/admin/rifas/${rifaId}?entrega=1` : `/admin/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`,
  );
}
