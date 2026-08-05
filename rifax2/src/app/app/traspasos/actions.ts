"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { resolverSolicitud, contextoDeUsuario, type Autorizador } from "@/lib/traspasos";

export async function resolverSolicitudAction(formData: FormData): Promise<void> {
  const user = await requirePermission("boleta.traspasar");
  const contexto = await contextoDeUsuario(user.tenant.id, user);
  // Admin/gerente sin sede fija: autoridad sobre solicitudes dirigidas a una sede.
  const autorizador: Autorizador = contexto ?? { tipo: "admin_tenant" };
  if (!contexto && user.rol === "vendedor") {
    redirect(`/app/traspasos?error=${encodeURIComponent("No se pudo determinar tu vendedor.")}`);
  }

  const solicitudId = BigInt(String(formData.get("solicitud_id") ?? "0"));
  const aprobar = formData.get("accion") === "aprobar";
  const motivo = String(formData.get("motivo") ?? "");
  const res = await resolverSolicitud(user.tenant.id, solicitudId, aprobar, autorizador, user.id, motivo);
  revalidatePath("/app/traspasos");
  redirect(res.ok ? "/app/traspasos?resuelto=1" : `/app/traspasos?error=${encodeURIComponent(res.error)}`);
}
