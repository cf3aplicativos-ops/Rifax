"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { guardarConfigPlataforma } from "@/lib/plataforma";
import { generarFacturaTenant, generarFacturacionMasiva, marcarFacturaPagada, anularFactura } from "@/lib/facturacion";

const back = (qs: string) => redirect(`/panel/facturacion?${qs}`);

export async function guardarPrecioAction(formData: FormData): Promise<void> {
  await requireSuper();
  const precio = Number(String(formData.get("precio_basico") ?? "").replace(/[^\d.]/g, ""));
  const corp = String(formData.get("precio_corporativo_texto") ?? "");
  const res = await guardarConfigPlataforma(precio, corp);
  revalidatePath("/panel/facturacion");
  back(res.ok ? "precio=1" : `error=${encodeURIComponent(res.error)}`);
}

export async function generarIndividualAction(formData: FormData): Promise<void> {
  await requireSuper();
  const montoStr = String(formData.get("monto") ?? "").trim();
  const monto = montoStr ? Number(montoStr.replace(/[^\d.]/g, "")) : undefined;
  const res = await generarFacturaTenant(
    BigInt(String(formData.get("tenant_id") ?? "0")),
    String(formData.get("periodo") ?? ""),
    monto,
  );
  revalidatePath("/panel/facturacion");
  back(res.ok ? "gen=1" : `error=${encodeURIComponent(res.error)}`);
}

export async function generarMasivaAction(formData: FormData): Promise<void> {
  await requireSuper();
  const res = await generarFacturacionMasiva(String(formData.get("periodo") ?? ""));
  revalidatePath("/panel/facturacion");
  back(res.ok ? `masiva=${res.data?.generadas ?? 0}` : `error=${encodeURIComponent(res.error)}`);
}

export async function marcarPagadaAction(formData: FormData): Promise<void> {
  await requireSuper();
  await marcarFacturaPagada(BigInt(String(formData.get("factura_id") ?? "0")));
  revalidatePath("/panel/facturacion");
  back("pago=1");
}

export async function anularFacturaAction(formData: FormData): Promise<void> {
  await requireSuper();
  await anularFactura(BigInt(String(formData.get("factura_id") ?? "0")));
  revalidatePath("/panel/facturacion");
  back("anulada=1");
}
