"use server";

import { consultarEstadoCuenta, type EstadoCuenta } from "@/lib/consulta";

export interface ConsultaState {
  error?: string;
  cuenta?: EstadoCuenta;
}

export async function consultarAction(_prev: ConsultaState, formData: FormData): Promise<ConsultaState> {
  const documento = String(formData.get("documento") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  if (!documento || !telefono) return { error: "Ingresa tu documento y tu teléfono." };

  const cuenta = await consultarEstadoCuenta(documento, telefono);
  if (!cuenta) return { error: "No encontramos una cuenta con ese documento y teléfono." };
  return { cuenta };
}
