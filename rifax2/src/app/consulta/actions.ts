"use server";

import { headers } from "next/headers";
import { consultarEstadoCuenta, type EstadoCuenta } from "@/lib/consulta";
import { permitir } from "@/lib/rate-limit";

export interface ConsultaState {
  error?: string;
  cuenta?: EstadoCuenta;
}

// La consulta es pública y devuelve datos personales del cliente. Sin límite,
// el par documento+teléfono es adivinable por fuerza bruta: 20 consultas por
// IP cada 10 minutos bastan de sobra para un uso legítimo.
const LIMITE_CONSULTAS = 20;
const VENTANA_MS = 10 * 60 * 1000;

export async function consultarAction(_prev: ConsultaState, formData: FormData): Promise<ConsultaState> {
  const documento = String(formData.get("documento") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  if (!documento || !telefono) return { error: "Ingresa tu documento y tu teléfono." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!permitir(`consulta:${ip}`, LIMITE_CONSULTAS, VENTANA_MS)) {
    return { error: "Demasiadas consultas seguidas. Espera unos minutos e inténtalo de nuevo." };
  }

  const cuenta = await consultarEstadoCuenta(documento, telefono);
  if (!cuenta) return { error: "No encontramos una cuenta con ese documento y teléfono." };
  return { cuenta };
}
