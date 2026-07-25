"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import {
  crearVendedor,
  cambiarEstadoVendedor,
  asignarTalonario,
  cerrarTalonario,
} from "@/lib/vendedores";

export interface VendedorFormState {
  error?: string;
}

export async function crearVendedorAction(
  _prev: VendedorFormState,
  formData: FormData,
): Promise<VendedorFormState> {
  const user = await requirePermission("vendedor.crear");

  const correo = String(formData.get("correo") ?? "").trim();
  const comision = String(formData.get("pct_comision") ?? "").trim();
  const cupo = String(formData.get("cupo_max") ?? "").trim();

  const res = await crearVendedor(
    {
      nombre: String(formData.get("nombre") ?? "").trim(),
      documento: String(formData.get("documento") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim(),
      ...(correo ? { correo } : {}),
      ...(comision ? { pct_comision: comision } : {}),
      ...(cupo ? { cupo_max: cupo } : {}),
    },
    user.id,
  );
  if (!res.ok) return { error: res.error };

  revalidatePath("/admin/vendedores");
  redirect("/admin/vendedores?creado=1");
}

export async function cambiarEstadoVendedorAction(formData: FormData): Promise<void> {
  const user = await requirePermission("vendedor.editar");
  const res = await cambiarEstadoVendedor(
    BigInt(String(formData.get("vendedor_id") ?? "0")),
    String(formData.get("estado") ?? ""),
    user.id,
  );
  revalidatePath("/admin/vendedores");
  redirect(
    res.ok ? "/admin/vendedores?estado=1" : `/admin/vendedores?error=${encodeURIComponent(res.error)}`,
  );
}

export async function asignarTalonarioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("talonario.asignar");
  const vendedorId = BigInt(String(formData.get("vendedor_id") ?? "0"));

  const res = await asignarTalonario(
    {
      rifaId: BigInt(String(formData.get("rifa_id") ?? "0")),
      vendedorId,
      inicio: Number(formData.get("inicio")),
      fin: Number(formData.get("fin")),
    },
    user.id,
  );

  revalidatePath(`/admin/vendedores/${vendedorId}`);
  redirect(
    res.ok
      ? `/admin/vendedores/${vendedorId}?asignadas=${res.data?.boletas ?? 0}`
      : `/admin/vendedores/${vendedorId}?error=${encodeURIComponent(res.error)}`,
  );
}

export async function cerrarTalonarioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("talonario.devolver");
  const vendedorId = String(formData.get("vendedor_id") ?? "0");

  const res = await cerrarTalonario(
    BigInt(String(formData.get("talonario_id") ?? "0")),
    user.id,
  );

  revalidatePath(`/admin/vendedores/${vendedorId}`);
  redirect(
    res.ok
      ? `/admin/vendedores/${vendedorId}?liberadas=${res.data?.liberadas ?? 0}`
      : `/admin/vendedores/${vendedorId}?error=${encodeURIComponent(res.error)}`,
  );
}
