"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { agregarPremio, agregarPremioAnticipado, editarPremioAnticipado, eliminarPremioAnticipado, eliminarPremio, guardarLogoRifa, guardarBoletaRifa, asignarBoletasSede, liberarBoletasSede, editarRifa } from "@/lib/rifas";
import { ejecutarSorteo, cambiarEntregaGanador } from "@/lib/sorteos";

export async function editarRifaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const tasa = String(formData.get("tasa_derechos") ?? "").trim();
  const res = await editarRifa(
    user.tenant.id,
    BigInt(rifaId),
    {
      nombre: String(formData.get("nombre") ?? ""),
      descripcion: String(formData.get("descripcion") ?? "") || undefined,
      loteria: String(formData.get("loteria") ?? "") || undefined,
      precio_boleta: String(formData.get("precio_boleta") ?? ""),
      fecha_apertura: String(formData.get("fecha_apertura") ?? ""),
      fecha_cierre_ventas: String(formData.get("fecha_cierre_ventas") ?? ""),
      fecha_sorteo: String(formData.get("fecha_sorteo") ?? ""),
      tasa_derechos: tasa || undefined,
    },
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?editada=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function agregarPremioAnticipadoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const valor = String(formData.get("valor_estimado") ?? "").trim();
  const pagos = String(formData.get("pagos_requeridos") ?? "").trim();
  const res = await agregarPremioAnticipado(
    user.tenant.id,
    BigInt(rifaId),
    {
      nombre: String(formData.get("nombre") ?? ""),
      loteria: String(formData.get("loteria") ?? "") || undefined,
      fecha_juego: String(formData.get("fecha_juego") ?? ""),
      pagos_requeridos: pagos ? Number(pagos) : 1,
      valor_estimado: valor ? Number(valor) : null,
    },
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?anticipado=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function editarPremioAnticipadoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const valor = String(formData.get("valor_estimado") ?? "").trim();
  const pagos = String(formData.get("pagos_requeridos") ?? "").trim();
  const res = await editarPremioAnticipado(
    user.tenant.id,
    BigInt(String(formData.get("premio_id") ?? "0")),
    {
      nombre: String(formData.get("nombre") ?? ""),
      loteria: String(formData.get("loteria") ?? "") || undefined,
      fecha_juego: String(formData.get("fecha_juego") ?? ""),
      pagos_requeridos: pagos ? Number(pagos) : 1,
      valor_estimado: valor ? Number(valor) : null,
    },
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?anticipado=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function eliminarPremioAnticipadoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const res = await eliminarPremioAnticipado(user.tenant.id, BigInt(String(formData.get("premio_id") ?? "0")), user.id);
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?anticipado=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function eliminarPremioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const res = await eliminarPremio(user.tenant.id, BigInt(String(formData.get("premio_id") ?? "0")), user.id);
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?premio=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function guardarLogoRifaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const imagen = formData.get("logo");
  const res = await guardarLogoRifa(
    user.tenant.id,
    BigInt(rifaId),
    imagen instanceof File ? imagen : null,
    formData.get("quitar") === "on",
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?logo=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

function expandirNumeros(texto: string): number[] {
  const out = new Set<number>();
  for (const parte of texto.split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(parte);
    if (m) { const a = Number(m[1]), b = Number(m[2]); for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n); }
    else if (/^\d+$/.test(parte)) out.add(Number(parte));
  }
  return [...out];
}

export async function asignarBoletasSedeAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const tipoRaw = String(formData.get("tipo") ?? "consecutiva");
  const tipo = tipoRaw === "aleatoria" ? "aleatoria" : tipoRaw === "especificas" ? "especificas" : "consecutiva";
  const res = await asignarBoletasSede(
    user.tenant.id,
    BigInt(rifaId),
    BigInt(String(formData.get("sede_id") ?? "0")),
    {
      tipo,
      ...(tipo === "consecutiva" ? { inicio: Number(formData.get("inicio")), fin: Number(formData.get("fin")) }
        : tipo === "especificas" ? { numeros: expandirNumeros(String(formData.get("numeros") ?? "")) }
        : { cantidad: Number(formData.get("cantidad")) }),
    },
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?asignadas=${res.data.asignadas}` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function liberarBoletasSedeAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const res = await liberarBoletasSede(user.tenant.id, BigInt(rifaId), BigInt(String(formData.get("sede_id") ?? "0")), user.id);
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?asignadas=0&liberadas=${res.data.liberadas}` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function guardarBoletaRifaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const imagen = formData.get("boleta");
  const res = await guardarBoletaRifa(
    user.tenant.id,
    BigInt(rifaId),
    imagen instanceof File ? imagen : null,
    formData.get("quitar") === "on",
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?boleta=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function agregarPremioAction(formData: FormData): Promise<void> {
  const user = await requirePermission("rifa.editar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const valor = String(formData.get("valor_estimado") ?? "").trim();
  const res = await agregarPremio(user.tenant.id, BigInt(rifaId), { nombre: String(formData.get("nombre") ?? ""), valorEstimado: valor ? Number(valor) : null }, user.id);
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?premio=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function ejecutarSorteoAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sorteo.ejecutar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const modalidad = String(formData.get("modalidad") ?? "commit_reveal") as "externo" | "commit_reveal";
  const numeroRaw = String(formData.get("numero_ganador") ?? "").trim();
  const evidencia = String(formData.get("evidencia_url") ?? "").trim();
  const res = await ejecutarSorteo(
    { rifaId: BigInt(rifaId), premioId: BigInt(String(formData.get("premio_id") ?? "0")), modalidad, ...(numeroRaw ? { numeroGanador: Number(numeroRaw) } : {}), ...(evidencia ? { evidenciaUrl: evidencia } : {}) },
    user.tenant.id,
    user.id,
  );
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?sorteo=${res.data?.numeroGanador}&ganador=${res.data?.conGanador ? 1 : 0}` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}

export async function cambiarEntregaAction(formData: FormData): Promise<void> {
  const user = await requirePermission("sorteo.ejecutar");
  const rifaId = String(formData.get("rifa_id") ?? "0");
  const res = await cambiarEntregaGanador(BigInt(String(formData.get("ganador_id") ?? "0")), user.tenant.id, String(formData.get("estado") ?? ""), user.id);
  revalidatePath(`/app/rifas/${rifaId}`);
  redirect(res.ok ? `/app/rifas/${rifaId}?entrega=1` : `/app/rifas/${rifaId}?error=${encodeURIComponent(res.error)}`);
}
