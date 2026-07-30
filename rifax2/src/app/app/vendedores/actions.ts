"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { crearVendedor, cambiarEstadoVendedor, asignarTalonario, cerrarTalonario } from "@/lib/vendedores";
import { crearAccesoVendedor } from "@/lib/portal-vendedor";

// Expande una lista tipo "7, 15, 42, 100-110" a un arreglo de números.
function expandirNumeros(texto: string): number[] {
  const out = new Set<number>();
  for (const parte of texto.split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(parte);
    if (m) {
      const a = Number(m[1]); const b = Number(m[2]);
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n);
    } else if (/^\d+$/.test(parte)) {
      out.add(Number(parte));
    }
  }
  return [...out];
}

export async function crearAccesoVendedorAction(formData: FormData): Promise<void> {
  const user = await requirePermission("usuario.crear");
  const vendedorId = String(formData.get("vendedor_id") ?? "0");
  const res = await crearAccesoVendedor(
    BigInt(vendedorId),
    user.tenant.id,
    String(formData.get("correo") ?? ""),
    String(formData.get("password") ?? ""),
    user.id,
  );
  revalidatePath(`/app/vendedores/${vendedorId}`);
  redirect(res.ok ? `/app/vendedores/${vendedorId}?acceso=1` : `/app/vendedores/${vendedorId}?error=${encodeURIComponent(res.error)}`);
}

export interface VendedorFormState {
  error?: string;
}

export async function crearVendedorAction(_prev: VendedorFormState, formData: FormData): Promise<VendedorFormState> {
  const user = await requirePermission("vendedor.crear");
  const correo = String(formData.get("correo") ?? "").trim();
  const comision = String(formData.get("pct_comision") ?? "").trim();
  const cupo = String(formData.get("cupo_max") ?? "").trim();
  const sede = String(formData.get("sede_id") ?? "").trim();
  const res = await crearVendedor(
    {
      ...(sede ? { sede_id: sede } : {}),
      nombre: String(formData.get("nombre") ?? "").trim(),
      documento: String(formData.get("documento") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim(),
      ...(correo ? { correo } : {}),
      ...(comision ? { pct_comision: comision } : {}),
      ...(cupo ? { cupo_max: cupo } : {}),
    },
    user.tenant.id,
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/vendedores");
  redirect("/app/vendedores?creado=1");
}

export async function cambiarEstadoVendedorAction(formData: FormData): Promise<void> {
  const user = await requirePermission("vendedor.editar");
  const res = await cambiarEstadoVendedor(BigInt(String(formData.get("vendedor_id") ?? "0")), user.tenant.id, String(formData.get("estado") ?? ""), user.id);
  revalidatePath("/app/vendedores");
  redirect(res.ok ? "/app/vendedores?estado=1" : `/app/vendedores?error=${encodeURIComponent(res.error)}`);
}

export async function asignarTalonarioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("talonario.asignar");
  const vendedorId = BigInt(String(formData.get("vendedor_id") ?? "0"));
  const tipoRaw = String(formData.get("tipo") ?? "consecutiva");
  const tipo = tipoRaw === "aleatoria" ? "aleatoria" : tipoRaw === "especificas" ? "especificas" : "consecutiva";
  const res = await asignarTalonario(
    {
      rifaId: BigInt(String(formData.get("rifa_id") ?? "0")),
      vendedorId,
      tipo,
      ...(tipo === "consecutiva"
        ? { inicio: Number(formData.get("inicio")), fin: Number(formData.get("fin")) }
        : tipo === "especificas"
          ? { numeros: expandirNumeros(String(formData.get("numeros") ?? "")) }
          : { cantidad: Number(formData.get("cantidad")) }),
    },
    user.tenant.id,
    user.id,
  );
  revalidatePath(`/app/vendedores/${vendedorId}`);
  redirect(res.ok ? `/app/vendedores/${vendedorId}?asignadas=${res.data?.boletas ?? 0}` : `/app/vendedores/${vendedorId}?error=${encodeURIComponent(res.error)}`);
}

export async function cerrarTalonarioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("talonario.devolver");
  const vendedorId = String(formData.get("vendedor_id") ?? "0");
  const res = await cerrarTalonario(BigInt(String(formData.get("talonario_id") ?? "0")), user.tenant.id, user.id);
  revalidatePath(`/app/vendedores/${vendedorId}`);
  redirect(res.ok ? `/app/vendedores/${vendedorId}?liberadas=${res.data?.liberadas ?? 0}` : `/app/vendedores/${vendedorId}?error=${encodeURIComponent(res.error)}`);
}
