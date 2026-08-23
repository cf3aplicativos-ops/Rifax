"use server";

import { confirmarReset } from "@/lib/reset-password";

export interface ConfirmarResetState { ok?: boolean; error?: string }

export async function confirmarResetAction(_prev: ConfirmarResetState, formData: FormData): Promise<ConfirmarResetState> {
  const token = String(formData.get("token") ?? "");
  const res = await confirmarReset(token);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
