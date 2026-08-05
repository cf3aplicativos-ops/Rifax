"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { resolverSolicitud, contextoDeUsuario } from "@/lib/traspasos";

export async function resolverSolicitudVendedorAction(formData: FormData): Promise<void> {
  const user = await requirePermission("boleta.traspasar");
  const contexto = await contextoDeUsuario(user.tenant.id, user);
  if (!contexto || contexto.tipo !== "vendedor") {
    redirect(`/vendedor/traspasos?error=${encodeURIComponent("No se pudo determinar tu vendedor.")}`);
  }
  const solicitudId = BigInt(String(formData.get("solicitud_id") ?? "0"));
  const aprobar = formData.get("accion") === "aprobar";
  const motivo = String(formData.get("motivo") ?? "");
  const res = await resolverSolicitud(user.tenant.id, solicitudId, aprobar, contexto, user.id, motivo);
  revalidatePath("/vendedor/traspasos");
  redirect(res.ok ? "/vendedor/traspasos?resuelto=1" : `/vendedor/traspasos?error=${encodeURIComponent(res.error)}`);
}
