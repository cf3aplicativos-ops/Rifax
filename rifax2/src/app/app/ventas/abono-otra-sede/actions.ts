"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { buscarVentasParaAbono, registrarAbono, ventaEnAlcanceOtraSede, type VentaBusquedaAbono } from "@/lib/ventas";

export interface BusquedaState {
  error?: string;
  resultados?: VentaBusquedaAbono[];
  criterio?: string;
}

// Solo roles de oficina: el permiso 'pago.registrar_otra_sede' no se le
// otorga a 'vendedor' por defecto, pero se bloquea el rol explícitamente
// también aquí (regla de negocio: "solo en la oficina"), por si un admin
// llegara a dárselo por error vía override de permisos.
async function requireOficina() {
  const user = await requirePermission("pago.registrar_otra_sede");
  if (user.rol === "vendedor") redirect("/app?denied=pago.registrar_otra_sede");
  return user;
}

export async function buscarVentaOtraSedeAction(_prev: BusquedaState, formData: FormData): Promise<BusquedaState> {
  const user = await requireOficina();
  const criterio = String(formData.get("criterio") ?? "").trim();
  if (!criterio) return { error: "Escribe el código de venta, el número de boleta o el documento del cliente." };
  const resultados = await buscarVentasParaAbono(user.tenant.id, criterio);
  if (resultados.length === 0) return { error: "No se encontró ninguna venta con ese dato.", criterio };
  return { resultados, criterio };
}

export interface AbonoOtraSedeState {
  error?: string;
  ok?: boolean;
  ventaId?: string;
}

export async function registrarAbonoOtraSedeAction(_prev: AbonoOtraSedeState, formData: FormData): Promise<AbonoOtraSedeState> {
  const user = await requireOficina();
  const ventaId = BigInt(String(formData.get("venta_id") ?? "0"));
  if (!(await ventaEnAlcanceOtraSede(user, ventaId))) return { error: "Venta no encontrada." };

  const res = await registrarAbono(
    user.tenant.id,
    ventaId,
    { monto: String(formData.get("monto") ?? "0"), origen: String(formData.get("origen") ?? "efectivo") as "efectivo" },
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath(`/app/ventas/${ventaId}/recibo`);
  return { ok: true, ventaId: String(ventaId) };
}
