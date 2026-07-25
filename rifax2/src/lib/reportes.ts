// Reportes de negocio y verificación de integridad.
// Usa SQL agregado para métricas siempre frescas y expone la verificación de la
// cadena de auditoría (función verificar_cadena_auditoria del esquema).
import "server-only";
import { prisma } from "@/lib/prisma";

export interface ResumenVentas {
  recaudado: string; // suma de abonos
  facturado: string; // suma de totales de ventas no anuladas
  porCobrar: string; // saldo pendiente de ventas vivas
  ventas: number;
  ventasPagadas: number;
}

export async function resumenVentas(): Promise<ResumenVentas> {
  const filas = await prisma.$queryRawUnsafe<
    {
      recaudado: string;
      facturado: string;
      por_cobrar: string;
      ventas: bigint;
      pagadas: bigint;
    }[]
  >(
    `SELECT
       COALESCE((SELECT SUM(monto) FROM abonos), 0)::text AS recaudado,
       COALESCE(SUM(total) FILTER (WHERE estado <> 'anulada'), 0)::text AS facturado,
       COALESCE(SUM(saldo) FILTER (WHERE estado IN ('pendiente_pago','parcial')), 0)::text AS por_cobrar,
       COUNT(*) FILTER (WHERE estado <> 'anulada') AS ventas,
       COUNT(*) FILTER (WHERE estado = 'pagada') AS pagadas
     FROM ventas`,
  );
  const r = filas[0];
  return {
    recaudado: r.recaudado,
    facturado: r.facturado,
    porCobrar: r.por_cobrar,
    ventas: Number(r.ventas),
    ventasPagadas: Number(r.pagadas),
  };
}

export interface AvanceRifa {
  rifaId: bigint;
  codigo: string;
  nombre: string;
  estado: string;
  totalBoletas: number;
  pagadas: number;
  reservadas: number;
  disponibles: number;
  recaudo: string;
  precio: string;
}

export async function avancePorRifa(): Promise<AvanceRifa[]> {
  const filas = await prisma.$queryRawUnsafe<
    {
      rifa_id: bigint;
      codigo: string;
      nombre: string;
      estado: string;
      total_boletas: number;
      pagadas: bigint;
      reservadas: bigint;
      disponibles: bigint;
      recaudo: string;
      precio: string;
    }[]
  >(
    `SELECT r.id AS rifa_id, r.codigo, r.nombre, r.estado, r.total_boletas,
            r.precio_boleta::text AS precio,
            COUNT(b.*) FILTER (WHERE b.estado = 'pagada')     AS pagadas,
            COUNT(b.*) FILTER (WHERE b.estado = 'reservada')  AS reservadas,
            COUNT(b.*) FILTER (WHERE b.estado = 'disponible') AS disponibles,
            COALESCE((SELECT SUM(a.monto) FROM abonos a
                       JOIN ventas v ON v.id = a.venta_id
                      WHERE v.rifa_id = r.id), 0)::text AS recaudo
       FROM rifas r
       LEFT JOIN boletas b ON b.rifa_id = r.id
      GROUP BY r.id
      ORDER BY r.id DESC`,
  );
  return filas.map((f) => ({
    rifaId: f.rifa_id,
    codigo: f.codigo,
    nombre: f.nombre,
    estado: f.estado,
    totalBoletas: f.total_boletas,
    pagadas: Number(f.pagadas),
    reservadas: Number(f.reservadas),
    disponibles: Number(f.disponibles),
    recaudo: f.recaudo,
    precio: f.precio,
  }));
}

export interface EstadoAuditoria {
  integra: boolean;
  rotaEnId: string | null;
  totalEventos: number;
  recientes: {
    id: string;
    accion: string;
    entidad: string;
    actorTipo: string;
    fecha: Date;
    hash: string | null;
  }[];
}

export async function verificarAuditoria(): Promise<EstadoAuditoria> {
  const [chk, total, recientes] = await Promise.all([
    prisma.$queryRawUnsafe<{ rota: bigint | null }[]>(
      "SELECT verificar_cadena_auditoria() AS rota",
    ),
    prisma.auditoria.count(),
    prisma.auditoria.findMany({
      orderBy: { id: "desc" },
      take: 15,
      select: {
        id: true,
        accion: true,
        entidad_tipo: true,
        actor_tipo: true,
        creado_en: true,
        hash_encadenado: true,
      },
    }),
  ]);

  const rota = chk[0].rota;
  return {
    integra: rota === null,
    rotaEnId: rota === null ? null : String(rota),
    totalEventos: total,
    recientes: recientes.map((e) => ({
      id: String(e.id),
      accion: e.accion,
      entidad: e.entidad_tipo,
      actorTipo: e.actor_tipo,
      fecha: e.creado_en,
      hash: e.hash_encadenado,
    })),
  };
}
