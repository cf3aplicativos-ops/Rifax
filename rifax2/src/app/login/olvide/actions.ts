"use server";

import { registrarSolicitudReset } from "@/lib/reset-password";

export interface OlvideState { ok?: boolean; error?: string }

export async function solicitarResetAction(_prev: OlvideState, formData: FormData): Promise<OlvideState> {
  const correo = String(formData.get("correo") ?? "").trim();
  const res = await registrarSolicitudReset(correo);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
