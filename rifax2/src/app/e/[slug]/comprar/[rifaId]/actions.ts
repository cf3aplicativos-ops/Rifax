"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { iniciarCompraPublica } from "@/lib/compra-publica";
import { permitir } from "@/lib/rate-limit";

export interface CompraState {
  error?: string;
}

// Sin sesión: cada intento reserva boletas (las bloquea hasta que se pague o
// se anule), así que sin límite un abuso automatizado podría "secuestrar"
// el inventario disponible. 8 intentos cada 10 minutos por IP alcanza de
// sobra para un comprador real (incluye reintentos si algo falla).
const LIMITE_COMPRAS = 8;
const VENTANA_MS = 10 * 60 * 1000;

export async function iniciarCompraAction(_prev: CompraState, formData: FormData): Promise<CompraState> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitir(`compra-publica:${ip}`, LIMITE_COMPRAS, VENTANA_MS)) {
    return { error: "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo." };
  }

  const slug = String(formData.get("slug") ?? "");
  const rifaIdStr = String(formData.get("rifa_id") ?? "0");
  const numeros = String(formData.get("numeros") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);
  if (numeros.length === 0) return { error: "Elige al menos un número." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const correo = String(formData.get("correo") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim();
  const consentimiento = formData.get("consentimiento") === "on";
  if (!consentimiento) return { error: "Debes autorizar el tratamiento de tus datos para continuar." };

  let rifaId: bigint;
  try { rifaId = BigInt(rifaIdStr); } catch { return { error: "Rifa inválida." }; }

  const origen = `${hdrs.get("x-forwarded-proto") ?? "https"}://${hdrs.get("host")}`;

  const res = await iniciarCompraPublica({
    slug, rifaId, numeros,
    cliente: { nombre, telefono, ...(correo ? { correo } : {}), ...(documento ? { documento } : {}), consentimiento_datos: true },
    origen,
  });
  if (!res.ok) return { error: res.error };
  if (!res.data) return { error: "Error inesperado al iniciar el pago." };
  redirect(res.data.checkoutUrl);
}
