// Branding por tenant (#6): logo y fondo del aplicativo + color primario.
// Las imágenes se guardan como data URI en tenant_config (sin almacenamiento
// externo). Límites de tamaño para no inflar la base.
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

type Resultado = { ok: true } | { ok: false; error: string };

const LIMITES: Record<"logo" | "fondo", number> = {
  logo: 400 * 1024, // 400 KB
  fondo: 1_500 * 1024, // 1.5 MB
};
const TIPOS_OK = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function getBranding(tenantId: bigint) {
  const c = await prisma.tenant_config.findUnique({ where: { tenant_id: tenantId } });
  return {
    logoUrl: c?.logo_url ?? null,
    fondoUrl: c?.fondo_url ?? null,
    colorPrimario: c?.color_primario ?? "#f5c518",
  };
}

async function fileADataUri(file: File | null, clase: "logo" | "fondo"): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null; // sin cambio
  if (!TIPOS_OK.includes(file.type)) return { error: "Formato no soportado (usa PNG, JPG, WEBP o SVG)." };
  if (file.size > LIMITES[clase]) return { error: `La imagen supera el límite (${Math.round(LIMITES[clase] / 1024)} KB).` };
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${file.type};base64,${b64}`;
}

export async function guardarBranding(
  tenantId: bigint,
  datos: { logo: File | null; fondo: File | null; color: string; quitarLogo?: boolean; quitarFondo?: boolean },
  actorId: bigint,
): Promise<Resultado> {
  const color = /^#[0-9a-fA-F]{6}$/.test(datos.color) ? datos.color : "#f5c518";

  const logo = await fileADataUri(datos.logo, "logo");
  if (logo && typeof logo === "object") return { ok: false, error: logo.error };
  const fondo = await fileADataUri(datos.fondo, "fondo");
  if (fondo && typeof fondo === "object") return { ok: false, error: fondo.error };

  const data: Record<string, unknown> = { color_primario: color, actualizado_en: new Date() };
  if (datos.quitarLogo) data.logo_url = null;
  else if (typeof logo === "string") data.logo_url = logo;
  if (datos.quitarFondo) data.fondo_url = null;
  else if (typeof fondo === "string") data.fondo_url = fondo;

  await prisma.$transaction(async (tx) => {
    await tx.tenant_config.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, color_primario: color, ...(typeof logo === "string" ? { logo_url: logo } : {}), ...(typeof fondo === "string" ? { fondo_url: fondo } : {}) },
      update: data,
    });
    await auditar(tx, { tenantId, actorId, accion: "config.branding", entidadTipo: "tenant", entidadId: tenantId, despues: { color, logo: data.logo_url !== undefined, fondo: data.fondo_url !== undefined } });
  });
  return { ok: true };
}
