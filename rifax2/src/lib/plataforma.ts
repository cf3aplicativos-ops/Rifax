// Servicios de plataforma (super-admin): configuración global (precio del plan
// básico), plan de cada tenant y carrusel de la landing. Tablas nuevas se
// acceden vía SQL crudo (saas.*) para no regenerar el cliente Prisma.
import "server-only";
import { prisma } from "@/lib/prisma";
import { esPlan } from "@/lib/planes";

type Resultado = { ok: true } | { ok: false; error: string };

// ---------- Configuración global ----------
export async function getConfigPlataforma(): Promise<{ precioBasico: number; precioCorporativoTexto: string }> {
  try {
    const filas = await prisma.$queryRawUnsafe<{ precio_basico: string; precio_corporativo_texto: string }[]>(
      `SELECT precio_basico::text, precio_corporativo_texto FROM saas.plataforma_config WHERE id = 1`,
    );
    const f = filas[0];
    return { precioBasico: f ? Number(f.precio_basico) : 99000, precioCorporativoTexto: f?.precio_corporativo_texto ?? "A medida" };
  } catch {
    return { precioBasico: 99000, precioCorporativoTexto: "A medida" };
  }
}

export async function guardarConfigPlataforma(precioBasico: number, precioCorporativoTexto: string): Promise<Resultado> {
  if (!Number.isFinite(precioBasico) || precioBasico < 0) return { ok: false, error: "El precio del plan básico debe ser un número ≥ 0." };
  await prisma.$executeRawUnsafe(
    `UPDATE saas.plataforma_config SET precio_basico = $1::numeric, precio_corporativo_texto = $2::text, actualizado_en = now() WHERE id = 1`,
    String(precioBasico),
    precioCorporativoTexto.trim() || "A medida",
  );
  return { ok: true };
}

// ---------- Fondo de la pantalla de login ----------
export async function getLoginFondo(): Promise<string | null> {
  try {
    const filas = await prisma.$queryRawUnsafe<{ login_fondo_url: string | null }[]>(
      `SELECT login_fondo_url FROM saas.plataforma_config WHERE id = 1`,
    );
    return filas[0]?.login_fondo_url ?? null;
  } catch {
    return null;
  }
}

export async function guardarLoginFondo(imagen: File | null, quitar: boolean): Promise<Resultado> {
  if (quitar) {
    await prisma.$executeRawUnsafe(`UPDATE saas.plataforma_config SET login_fondo_url = NULL WHERE id = 1`);
    return { ok: true };
  }
  if (!imagen || imagen.size === 0) return { ok: false, error: "Selecciona una imagen." };
  if (!TIPOS_OK.includes(imagen.type)) return { ok: false, error: "Formato no soportado (usa PNG, JPG, WEBP o SVG)." };
  if (imagen.size > LIMITE_IMG) return { ok: false, error: `La imagen supera el límite (${Math.round(LIMITE_IMG / 1024)} KB).` };
  const b64 = Buffer.from(await imagen.arrayBuffer()).toString("base64");
  await prisma.$executeRawUnsafe(`UPDATE saas.plataforma_config SET login_fondo_url = $1 WHERE id = 1`, `data:${imagen.type};base64,${b64}`);
  return { ok: true };
}

// ---------- Plan del tenant ----------
export async function cambiarPlanTenant(tenantId: bigint, plan: string, superAdminId: bigint): Promise<Resultado> {
  if (!esPlan(plan)) return { ok: false, error: "Plan inválido." };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE saas.tenants SET plan = $1::text, actualizado_en = now() WHERE id = $2::bigint`, plan, tenantId);
    await tx.$executeRawUnsafe(
      `SELECT saas.registrar_auditoria($1::bigint,'superadmin','tenant.plan','tenant',$2::bigint,NULL,$3::jsonb,NULL,$2::bigint)`,
      superAdminId, tenantId, JSON.stringify({ plan }),
    );
  });
  return { ok: true };
}

// ---------- Carrusel de la landing ----------
export interface SlideDB { id: string; imagen_url: string | null; titulo: string | null; subtitulo: string | null; orden: number; activo: boolean }

export async function listarSlides(): Promise<SlideDB[]> {
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; imagen_url: string | null; titulo: string | null; subtitulo: string | null; orden: number; activo: boolean }[]>(
    `SELECT id, imagen_url, titulo, subtitulo, orden, activo FROM saas.landing_slides ORDER BY orden ASC, id ASC`,
  );
  return filas.map((f) => ({ id: String(f.id), imagen_url: f.imagen_url, titulo: f.titulo, subtitulo: f.subtitulo, orden: f.orden, activo: f.activo }));
}

export async function slidesActivos(): Promise<{ imagen?: string; titulo?: string; subtitulo?: string }[]> {
  try {
    const filas = await prisma.$queryRawUnsafe<{ imagen_url: string | null; titulo: string | null; subtitulo: string | null }[]>(
      `SELECT imagen_url, titulo, subtitulo FROM saas.landing_slides WHERE activo = true ORDER BY orden ASC, id ASC`,
    );
    return filas.map((f) => ({
      imagen: f.imagen_url ?? undefined,
      titulo: f.titulo ?? undefined,
      subtitulo: f.subtitulo ?? undefined,
    }));
  } catch {
    return [];
  }
}

const LIMITE_IMG = 2_000 * 1024; // 2 MB
const TIPOS_OK = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function crearSlide(datos: { imagen: File | null; titulo: string; subtitulo: string; orden: number }): Promise<Resultado> {
  let imagenUrl: string | null = null;
  if (datos.imagen && datos.imagen.size > 0) {
    if (!TIPOS_OK.includes(datos.imagen.type)) return { ok: false, error: "Formato no soportado (usa PNG, JPG, WEBP o SVG)." };
    if (datos.imagen.size > LIMITE_IMG) return { ok: false, error: `La imagen supera el límite (${Math.round(LIMITE_IMG / 1024)} KB).` };
    const b64 = Buffer.from(await datos.imagen.arrayBuffer()).toString("base64");
    imagenUrl = `data:${datos.imagen.type};base64,${b64}`;
  }
  if (!imagenUrl && !datos.titulo.trim() && !datos.subtitulo.trim()) {
    return { ok: false, error: "Sube una imagen o escribe al menos un título." };
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO saas.landing_slides (imagen_url, titulo, subtitulo, orden) VALUES ($1,$2,$3,$4::smallint)`,
    imagenUrl,
    datos.titulo.trim() || null,
    datos.subtitulo.trim() || null,
    Number.isFinite(datos.orden) ? datos.orden : 0,
  );
  return { ok: true };
}

export async function eliminarSlide(id: bigint): Promise<Resultado> {
  await prisma.$executeRawUnsafe(`DELETE FROM saas.landing_slides WHERE id = $1::bigint`, id);
  return { ok: true };
}

export async function toggleSlide(id: bigint): Promise<Resultado> {
  await prisma.$executeRawUnsafe(`UPDATE saas.landing_slides SET activo = NOT activo WHERE id = $1::bigint`, id);
  return { ok: true };
}
