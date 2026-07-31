"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { crearVenta, registrarAbono, anularVenta, editarAbono, eliminarAbono } from "@/lib/ventas";
import { actualizarCliente, cambiarEstadoCliente } from "@/lib/clientes";
import { numerosPermitidosVendedor } from "@/lib/portal-vendedor";

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

  const rifaIdStr = String(formData.get("rifa_id") ?? "");

  // Si quien vende es un vendedor, la venta se atribuye a él y solo puede
  // vender boletas de sus propios talonarios (blindaje de servidor).
  let vendedorId: bigint | undefined;
  if (user.rol === "vendedor") {
    const vend = await prisma.vendedores.findFirst({
      where: { tenant_id: user.tenant.id, usuario_id: user.id },
      select: { id: true },
    });
    if (!vend) return { error: "Tu usuario no está vinculado a un vendedor." };
    let rifaId: bigint;
    try { rifaId = BigInt(rifaIdStr); } catch { return { error: "Rifa inválida." }; }
    const permitido = await numerosPermitidosVendedor(user.tenant.id, vend.id, rifaId, numeros);
    if (!permitido) return { error: "Solo puedes vender boletas de tus talonarios asignados." };
    vendedorId = vend.id;
  }

  const correo = String(formData.get("correo") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim();
  const input = {
    rifa_id: rifaIdStr,
    numeros,
    cliente: {
      nombre: String(formData.get("nombre") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim(),
      ...(correo ? { correo } : {}),
      ...(documento ? { documento } : {}),
      consentimiento_datos: formData.get("consentimiento") === "on",
    },
    ...(vendedorId ? { vendedor_id: String(vendedorId) } : {}),
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

export async function editarAbonoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pago.registrar");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const res = await editarAbono(
    user.tenant.id,
    BigInt(String(formData.get("abono_id") ?? "0")),
    { monto: String(formData.get("monto") ?? "0"), origen: String(formData.get("origen") ?? "efectivo") },
    user.id,
  );
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?abono=ok` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}

export async function eliminarAbonoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("pago.registrar");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const res = await eliminarAbono(user.tenant.id, BigInt(String(formData.get("abono_id") ?? "0")), user.id);
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?abono=ok` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}

export async function editarClienteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("venta.crear");
  const ventaId = String(formData.get("venta_id") ?? "0");
  const res = await actualizarCliente(
    user.tenant.id,
    BigInt(String(formData.get("cliente_id") ?? "0")),
    {
      nombre: String(formData.get("nombre") ?? ""),
      telefono: String(formData.get("telefono") ?? ""),
      correo: String(formData.get("correo") ?? ""),
      documento: String(formData.get("documento") ?? ""),
    },
    user.id,
  );
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?cliente=1` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarEstadoClienteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("venta.crear");
  const ventaId = String(formData.get("venta_id") ?? "0");
  const res = await cambiarEstadoCliente(user.tenant.id, BigInt(String(formData.get("cliente_id") ?? "0")), String(formData.get("estado") ?? ""), user.id);
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?cliente=1` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}

export async function anularVentaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("venta.anular");
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  const res = await anularVenta(user.tenant.id, ventaId, String(formData.get("motivo") ?? ""), user.id);
  revalidatePath(`/app/ventas/${ventaId}`);
  redirect(res.ok ? `/app/ventas/${ventaId}?anulada=ok` : `/app/ventas/${ventaId}?error=${encodeURIComponent(res.error)}`);
}
