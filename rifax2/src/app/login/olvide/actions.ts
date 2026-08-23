"use server";

import { headers } from "next/headers";
import { solicitarResetAutomatico } from "@/lib/reset-password";
import { permitir } from "@/lib/rate-limit";

export interface OlvideState { ok?: boolean; error?: string }

// Aunque el token de un solo uso (2026-08-23) ya impide que alguien sin
// acceso al correo del titular complete el cambio, se mantiene el
// rate-limit: sin él, cualquiera que conozca un correo podría saturar su
// bandeja pidiendo enlaces de reset sin límite. 3 solicitudes por correo y
// 10 por IP cada hora.
const VENTANA_MS = 60 * 60 * 1000;

export async function solicitarResetAction(_prev: OlvideState, formData: FormData): Promise<OlvideState> {
  const correo = String(formData.get("correo") ?? "").trim();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  const okCorreo = permitir(`reset:correo:${correo.toLowerCase()}`, 3, VENTANA_MS);
  const okIp = permitir(`reset:ip:${ip}`, 10, VENTANA_MS);
  // Respuesta genérica: no revela si el correo existe ni que hubo un límite.
  if (!okCorreo || !okIp) return { ok: true };

  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const origen = `${proto}://${h.get("host")}`;
  const res = await solicitarResetAutomatico(correo, origen);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
