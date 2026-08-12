// Landing pública por empresa (punto 4): branding + rifas activas, sin
// sesión. Sirve tanto para el subdominio/slug de la plataforma como para el
// dominio propio de la empresa (una vez conectado en Vercel, ver punto 4b).
import "server-only";
import { prisma } from "@/lib/prisma";

export interface LandingTenant {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  colorPrimario: string;
}

export interface LandingRifa {
  id: string;
  codigo: string;
  nombre: string;
  precioBoleta: string;
  premioPrincipal: string | null;
  boletaImagenUrl: string | null;
  disponibles: number;
  totalBoletas: number;
  fechaSorteo: Date;
}

export async function obtenerLandingTenant(slug: string): Promise<{ tenant: LandingTenant; rifas: LandingRifa[] } | null> {
  const tenant = await prisma.tenants.findFirst({
    where: { slug, estado: "activo" },
    select: { id: true, nombre: true, slug: true },
  });
  if (!tenant) return null;

  const config = await prisma.tenant_config.findUnique({ where: { tenant_id: tenant.id } });

  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; codigo: string; nombre: string; precio_boleta: string; boleta_url: string | null; fecha_sorteo: Date; total_boletas: number; disponibles: bigint; premio_principal: string | null }[]
  >(
    `SELECT r.id, r.codigo, r.nombre, r.precio_boleta::text AS precio_boleta, r.boleta_url, r.fecha_sorteo, r.total_boletas,
            (SELECT COUNT(*) FROM saas.boletas b WHERE b.rifa_id = r.id AND b.estado = 'disponible') AS disponibles,
            (SELECT p.nombre FROM saas.premios p WHERE p.rifa_id = r.id ORDER BY p.orden ASC LIMIT 1) AS premio_principal
       FROM saas.rifas r
      WHERE r.tenant_id = $1::bigint AND r.estado = 'activa'
      ORDER BY r.fecha_sorteo ASC`,
    tenant.id,
  );

  return {
    tenant: {
      id: String(tenant.id), nombre: tenant.nombre, slug: tenant.slug,
      logoUrl: config?.logo_url ?? null, colorPrimario: config?.color_primario ?? "#f5c518",
    },
    rifas: filas.map((f) => ({
      id: String(f.id), codigo: f.codigo, nombre: f.nombre, precioBoleta: f.precio_boleta,
      premioPrincipal: f.premio_principal, boletaImagenUrl: f.boleta_url,
      disponibles: Number(f.disponibles), totalBoletas: f.total_boletas, fechaSorteo: f.fecha_sorteo,
    })),
  };
}
