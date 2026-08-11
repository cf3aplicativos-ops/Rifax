"use server";

import { headers } from "next/headers";
import { solicitarResetAutomatico } from "@/lib/reset-password";
import { permitir } from "@/lib/rate-limit";

export interface OlvideState { ok?: boolean; error?: string }

// El restablecimiento cambia la contraseña en el acto: sin límite, cualquiera
// que conozca un correo podría dejar fuera a ese usuario de forma repetida y
// saturar su bandeja. 3 solicitudes por correo y 10 por IP cada hora.
const VENTANA_MS = 60 * 60 * 1000;

export async function solicitarResetAction(_prev: OlvideState, formData: FormData): Promise<OlvideState> {
  const correo = String(formData.get("correo") ?? "").trim();

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  const okCorreo = permitir(`reset:correo:${correo.toLowerCase()}`, 3, VENTANA_MS);
  const okIp = permitir(`reset:ip:${ip}`, 10, VENTANA_MS);
  // Respuesta genérica: no revela si el correo existe ni que hubo un límite.
  if (!okCorreo || !okIp) return { ok: true };

  const res = await solicitarResetAutomatico(correo);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
