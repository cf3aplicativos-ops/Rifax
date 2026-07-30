import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Resultados públicos de sorteos (número ganador + nombre del ganador).
// Se usa en la landing para mostrar resultados "en tiempo real". El nombre del
// ganador se enmascara (nombre + inicial del apellido) por privacidad.
type Fila = {
  numero_ganador: number;
  numero_digitos: number;
  ejecutado_en: Date;
  rifa: string;
  premio: string | null;
  empresa: string;
  ganador: string | null;
};

function enmascarar(nombre: string | null): string {
  if (!nombre) return "Boleta no vendida";
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

export async function GET() {
  try {
    const filas = await prisma.$queryRawUnsafe<Fila[]>(`
      SELECT s.numero_ganador,
             r.numero_digitos,
             s.ejecutado_en,
             r.nombre       AS rifa,
             pr.nombre      AS premio,
             t.nombre       AS empresa,
             cl.nombre      AS ganador
      FROM saas.sorteos s
      JOIN saas.rifas r        ON r.id = s.rifa_id
      JOIN saas.tenants t      ON t.id = s.tenant_id
      LEFT JOIN saas.ganadores g ON g.sorteo_id = s.id
      LEFT JOIN saas.clientes cl ON cl.id = g.cliente_id
      LEFT JOIN saas.premios pr  ON pr.id = s.premio_id
      ORDER BY s.ejecutado_en DESC
      LIMIT 8
    `);

    const data = filas.map((f) => ({
      numero: String(f.numero_ganador).padStart(f.numero_digitos ?? 4, "0"),
      rifa: f.rifa,
      premio: f.premio,
      empresa: f.empresa,
      ganador: enmascarar(f.ganador),
      fecha: f.ejecutado_en,
    }));

    return NextResponse.json({ ok: true, ganadores: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, ganadores: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
