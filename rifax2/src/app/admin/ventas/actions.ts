"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { crearVenta, registrarAbono, anularVenta } from "@/lib/ventas";

export interface VentaFormState {
  error?: string;
}

export async function crearVentaAction(
  _prev: VentaFormState,
  formData: FormData,
): Promise<VentaFormState> {
  const user = await requirePermission("venta.crear");

  // "1, 2, 7" | "1 2 7" -> [1, 2, 7]
  const numeros = String(formData.get("numeros") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  if (numeros.length === 0) return { error: "Indica al menos un número de boleta." };
  if (numeros.some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Los números de boleta deben ser enteros no negativos." };
  }

  const correo = String(formData.get("correo") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim();

  const vendedorId = String(formData.get("vendedor_id") ?? "").trim();

  const input = {
    rifa_id: String(formData.get("rifa_id") ?? ""),
    numeros,
    ...(vendedorId ? { vendedor_id: vendedorId } : {}),
    cliente: {
      nombre: String(formData.get("nombre") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim(),
      ...(correo ? { correo } : {}),
      ...(documento ? { documento } : {}),
      consentimiento_datos: formData.get("consentimiento") === "on",
    },
    canal: String(formData.get("canal") ?? "web"),
  };

  // Clave de idempotencia emitida por el formulario: reenviar el mismo
  // formulario no crea una segunda venta.
  const idem = String(formData.get("idem") ?? "").trim() || null;

  const res = await crearVenta(input, user.id, idem);
  if (!res.ok) return { error: res.error };

  revalidatePath("/admin/ventas");
  redirect(`/admin/ventas/${res.data.ventaId}`);
}

export async function registrarAbonoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pago.registrar");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const monto = Number(formData.get("monto") ?? 0);
  const origen = String(formData.get("origen") ?? "efectivo") as
    | "pasarela"
    | "comprobante"
    | "efectivo"
    | "ajuste";

  const res = await registrarAbono(ventaId, { monto, origen }, user.id);
  revalidatePath(`/admin/ventas/${ventaId}`);
  revalidatePath("/admin/ventas");

  redirect(
    res.ok
      ? `/admin/ventas/${ventaId}?abono=ok`
      : `/admin/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`,
  );
}

export async function anularVentaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("venta.anular");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const motivo = String(formData.get("motivo") ?? "");

  const res = await anularVenta(ventaId, motivo, user.id);
  revalidatePath(`/admin/ventas/${ventaId}`);
  revalidatePath("/admin/ventas");

  redirect(
    res.ok
      ? `/admin/ventas/${ventaId}?anulada=ok`
      : `/admin/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`,
  );
}
