// Catálogos configurables (#5): alimentan las listas desplegables del aplicativo.
// Cada `tipo` es un dropdown; sus items son las opciones. Si un tenant no tiene
// items para un tipo, se usan los valores por defecto (fallback), así el sistema
// funciona sin configuración previa.
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

type Resultado = { ok: true } | { ok: false; error: string };

/** Tipos de lista conocidos por la app, con sus opciones por defecto. */
export const TIPOS: { tipo: string; titulo: string; defaults: { valor: string; etiqueta: string }[] }[] = [
  {
    tipo: "canal_venta",
    titulo: "Canales de venta",
    defaults: [
      { valor: "web", etiqueta: "Web" },
      { valor: "whatsapp", etiqueta: "WhatsApp" },
      { valor: "vendedor", etiqueta: "Vendedor" },
      { valor: "pos", etiqueta: "Punto de venta" },
    ],
  },
  {
    tipo: "origen_abono",
    titulo: "Orígenes de abono",
    defaults: [
      { valor: "efectivo", etiqueta: "Efectivo" },
      { valor: "pasarela", etiqueta: "Pasarela" },
      { valor: "comprobante", etiqueta: "Comprobante" },
      { valor: "ajuste", etiqueta: "Ajuste" },
    ],
  },
  {
    tipo: "canal_mensaje",
    titulo: "Canales de mensajería",
    defaults: [
      { valor: "whatsapp", etiqueta: "WhatsApp" },
      { valor: "sms", etiqueta: "SMS" },
      { valor: "correo", etiqueta: "Correo" },
    ],
  },
];

export interface Opcion {
  valor: string;
  etiqueta: string;
}

/** Opciones activas de un tipo para un tenant; si no hay, usa los defaults. */
export async function opcionesDe(tenantId: bigint, tipo: string): Promise<Opcion[]> {
  const filas = await prisma.catalogos.findMany({
    where: { tenant_id: tenantId, tipo, activo: true },
    orderBy: { orden: "asc" },
    select: { valor: true, etiqueta: true },
  });
  if (filas.length > 0) return filas;
  return TIPOS.find((t) => t.tipo === tipo)?.defaults ?? [];
}

export async function listarCatalogos(tenantId: bigint) {
  const filas = await prisma.catalogos.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ tipo: "asc" }, { orden: "asc" }],
  });
  const porTipo = new Map<string, typeof filas>();
  for (const f of filas) {
    const arr = porTipo.get(f.tipo) ?? [];
    arr.push(f);
    porTipo.set(f.tipo, arr);
  }
  return porTipo;
}

export async function agregarItem(
  tenantId: bigint,
  tipo: string,
  valor: string,
  etiqueta: string,
  actorId: bigint,
): Promise<Resultado> {
  const v = valor.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v) return { ok: false, error: "El valor es obligatorio." };
  if (!etiqueta.trim()) return { ok: false, error: "La etiqueta es obligatoria." };
  if (!TIPOS.some((t) => t.tipo === tipo)) return { ok: false, error: "Tipo de lista desconocido." };

  const dup = await prisma.catalogos.findFirst({ where: { tenant_id: tenantId, tipo, valor: v } });
  if (dup) return { ok: false, error: "Ya existe una opción con ese valor." };

  const max = await prisma.catalogos.aggregate({ where: { tenant_id: tenantId, tipo }, _max: { orden: true } });
  await prisma.$transaction(async (tx) => {
    const item = await tx.catalogos.create({
      data: { tenant_id: tenantId, tipo, valor: v, etiqueta: etiqueta.trim(), orden: (max._max.orden ?? 0) + 1, activo: true },
    });
    await auditar(tx, { tenantId, actorId, accion: "config.catalogo", entidadTipo: "catalogo", entidadId: item.id, despues: { tipo, valor: v, etiqueta } });
  });
  return { ok: true };
}

export async function toggleItem(tenantId: bigint, id: bigint, actorId: bigint): Promise<Resultado> {
  const item = await prisma.catalogos.findFirst({ where: { id, tenant_id: tenantId } });
  if (!item) return { ok: false, error: "Opción no encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.catalogos.update({ where: { id }, data: { activo: !item.activo } });
    await auditar(tx, { tenantId, actorId, accion: "config.catalogo", entidadTipo: "catalogo", entidadId: id, antes: { activo: item.activo }, despues: { activo: !item.activo } });
  });
  return { ok: true };
}
