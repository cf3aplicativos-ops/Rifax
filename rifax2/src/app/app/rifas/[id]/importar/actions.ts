"use server";

import { requirePermission } from "@/lib/auth/rbac";
import { importarVendedores, importarVentas, type ResultadoImport } from "@/lib/importar";

export interface ImportState { resultado?: ResultadoImport; tipo?: "vendedores" | "ventas"; error?: string }

export async function importarVendedoresAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requirePermission("vendedor.crear");
  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo plantilla_vendedores.csv." };
  const csv = await file.text();
  const resultado = await importarVendedores(user.tenant.id, csv, user.id);
  return { resultado, tipo: "vendedores" };
}

export async function importarVentasAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requirePermission("venta.crear");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo plantilla_ventas.csv." };
  const csv = await file.text();
  const resultado = await importarVentas(user.tenant.id, BigInt(rifaId), csv, user.id);
  return { resultado, tipo: "ventas" };
}
