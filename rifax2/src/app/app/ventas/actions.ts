"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { crearVenta, registrarAbono, anularVenta } from "@/lib/ventas";

export interface VentaFormState {
  error?: string;
}

export async function crearVentaAction(_prev: VentaFormState, formData: FormData): Promise<VentaFormState> {
  const user = await requirePermission("venta.crear");

  const numeros = String(formData.get("numeros") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (numeros.length === 0) return { error: "Indica al menos un número de boleta." };
  if (numeros.some((n) => !Number.isInteger(n) || n < 0)) return { error: "Números de boleta inválidos." };

  const correo = String(formData.get("correo") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim();
  const input = {
    rifa_id: String(formData.get("rifa_id") ?? ""),
    numeros,
    cliente: {
      nombre: String(formData.get("nombre") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim(),
      ...(correo ? { correo } : {}),
      ...(documento ? { documento } : {}),
      consentimiento_datos: formData.get("consentimiento") === "on",
    },
    canal: String(formData.get("canal") ?? "web"),
  };
  const idem = String(formData.get("idem") ?? "").trim() || null;

  const res = await crearVenta(input, user.tenant.id, user.id, idem);
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/ventas");
  redirect(`/app/ventas/${res.data.ventaId}`);
}

export async function registrarAbonoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pago.registrar");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const res = await registrarAbono(
    user.tenant.id,
    ventaId,
    { monto: String(formData.get("monto") ?? "0"), origen: String(formData.get("origen") ?? "efectivo") as "efectivo" },
    user.id,
  );
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?abono=ok` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}

export async function anularVentaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("venta.anular");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const res = await anularVenta(user.tenant.id, ventaId, String(formData.get("motivo") ?? ""), user.id);
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?anulada=ok` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}
