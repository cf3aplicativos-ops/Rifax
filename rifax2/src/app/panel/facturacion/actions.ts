"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { guardarConfigPlataforma } from "@/lib/plataforma";
import { generarFacturaTenant, generarFacturacionMasiva, marcarFacturaPagada, anularFactura } from "@/lib/facturacion";

const back = (qs: string) => redirect(`/panel/facturacion?${qs}`);

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d.]/g, ""));

export async function guardarPrecioAction(formData: FormData): Promise<void> {
  await requireSuper();
  const res = await guardarConfigPlataforma({
    precioBasicoMensual: num(formData.get("precio_basico_mensual")),
    precioBasicoSemestral: num(formData.get("precio_basico_semestral")),
    precioBasicoAnual: num(formData.get("precio_basico_anual")),
    precioCorporativoTexto: String(formData.get("precio_corporativo_texto") ?? ""),
    sedesBasico: num(formData.get("sedes_basico")),
    sedesCorporativo: num(formData.get("sedes_corporativo")),
  });
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
  const res = await marcarFacturaPagada(BigInt(String(formData.get("factura_id") ?? "0")));
  revalidatePath("/panel/facturacion");
  back(res.ok ? "pago=1" : `error=${encodeURIComponent(res.error)}`);
}

export async function anularFacturaAction(formData: FormData): Promise<void> {
  await requireSuper();
  const res = await anularFactura(BigInt(String(formData.get("factura_id") ?? "0")));
  revalidatePath("/panel/facturacion");
  back(res.ok ? "anulada=1" : `error=${encodeURIComponent(res.error)}`);
}
