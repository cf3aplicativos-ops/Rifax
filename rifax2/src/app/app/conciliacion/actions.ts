"use server";

import { requirePermission } from "@/lib/auth/rbac";
import {
  analizarExtracto,
  analizarExtractoCsv,
  analizarReporteVendedor,
  analizarComprobantes,
  aplicarConciliacion,
  type Sugerencia,
} from "@/lib/conciliacion";

const MAX_IMAGEN = 5 * 1024 * 1024; // 5MB
const MAX_CSV = 5 * 1024 * 1024; // 5MB

export interface AnalisisState {
  error?: string;
  sugerencias?: Sugerencia[];
}

export async function analizarExtractoAction(_prev: AnalisisState, formData: FormData): Promise<AnalisisState> {
  const user = await requirePermission("conciliacion.usar");
  const archivo = formData.get("csv");

  if (archivo instanceof File && archivo.size > 0) {
    if (!/\.(csv|txt)$/i.test(archivo.name)) return { error: "El archivo debe ser un CSV (si lo tienes en Excel, usa Archivo > Guardar como > CSV)." };
    if (archivo.size > MAX_CSV) return { error: "El archivo supera 5MB." };
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const r = await analizarExtractoCsv(user.tenant.id, buffer);
    return r.ok ? { sugerencias: r.data } : { error: r.error };
  }

  const texto = String(formData.get("texto") ?? "");
  const r = await analizarExtracto(user.tenant.id, texto);
  return r.ok ? { sugerencias: r.data } : { error: r.error };
}

export async function analizarReporteAction(_prev: AnalisisState, formData: FormData): Promise<AnalisisState> {
  const user = await requirePermission("conciliacion.usar");
  const vendedorIdRaw = String(formData.get("vendedorId") ?? "");
  if (!vendedorIdRaw) return { error: "Selecciona el vendedor que hizo el reporte." };
  const texto = String(formData.get("texto") ?? "");
  const r = await analizarReporteVendedor(user.tenant.id, BigInt(vendedorIdRaw), texto);
  return r.ok ? { sugerencias: r.data } : { error: r.error };
}

export async function analizarComprobantesAction(_prev: AnalisisState, formData: FormData): Promise<AnalisisState> {
  const user = await requirePermission("conciliacion.usar");
  const archivos = formData.getAll("imagenes").filter((f): f is File => f instanceof File && f.size > 0);
  if (archivos.length === 0) return { error: "Sube al menos un comprobante." };

  const imagenesDataUrl: string[] = [];
  for (const f of archivos) {
    if (f.size > MAX_IMAGEN) return { error: `La imagen "${f.name}" supera 5MB.` };
    if (!f.type.startsWith("image/")) return { error: `"${f.name}" no es una imagen.` };
    const buffer = Buffer.from(await f.arrayBuffer());
    imagenesDataUrl.push(`data:${f.type};base64,${buffer.toString("base64")}`);
  }

  const r = await analizarComprobantes(user.tenant.id, imagenesDataUrl);
  return r.ok ? { sugerencias: r.data } : { error: r.error };
}

export interface ConfirmarState {
  error?: string;
  ok?: boolean;
  aplicadas?: number;
  total?: number;
  fallidas?: number;
}

export async function confirmarConciliacionAction(_prev: ConfirmarState, formData: FormData): Promise<ConfirmarState> {
  const user = await requirePermission("conciliacion.usar");
  const modoRaw = String(formData.get("modo") ?? "extracto");
  const modo = modoRaw === "reporte" || modoRaw === "comprobante" ? modoRaw : "extracto";
  let aprobadas: { ventaId: string; monto: number }[] = [];
  try {
    aprobadas = JSON.parse(String(formData.get("aprobadas") ?? "[]"));
  } catch {
    return { error: "No se pudo leer la selección. Vuelve a analizar." };
  }
  const r = await aplicarConciliacion(user.tenant.id, modo, aprobadas, user.id);
  return r.ok
    ? { ok: true, aplicadas: r.data?.aplicadas ?? 0, total: r.data?.total ?? 0, fallidas: r.data?.fallidas ?? 0 }
    : { error: r.error };
}
