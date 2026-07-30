// Cartera (multi-tenant): ventas con saldo pendiente, clasificadas por tramo de
// mora. Se calcula en SQL, filtrando por tenant (y sede si el usuario está acotado).
import "server-only";
import { prisma } from "@/lib/prisma";

export interface FilaCartera {
  venta_id: bigint;
  codigo: string;
  cliente: string;
  telefono: string;
  total: string;
  saldo: string;
  dias_antiguedad: number;
  tramo: string;
}

export const tramoLabel: Record<string, string> = {
  corriente: "Corriente",
  mora_1: "Mora 1 (8–15 d)",
  mora_2: "Mora 2 (16–30 d)",
  mora_3: "Mora 3 (>30 d)",
};

export const tramoClase: Record<string, string> = {
  corriente: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  mora_1: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  mora_2: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  mora_3: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export async function listarCartera(tenantId: bigint, sedeId: bigint | null, vendedorId?: bigint | null): Promise<FilaCartera[]> {
  return prisma.$queryRawUnsafe<FilaCartera[]>(
    `SELECT v.id AS venta_id, v.codigo, cl.nombre AS cliente, cl.telefono,
            v.total::text AS total, v.saldo::text AS saldo,
            EXTRACT(DAY FROM now() - v.creado_en)::int AS dias_antiguedad,
            CASE
              WHEN now() - v.creado_en <= INTERVAL '7 days'  THEN 'corriente'
              WHEN now() - v.creado_en <= INTERVAL '15 days' THEN 'mora_1'
              WHEN now() - v.creado_en <= INTERVAL '30 days' THEN 'mora_2'
              ELSE 'mora_3'
            END AS tramo
       FROM saas.ventas v
       JOIN saas.clientes cl ON cl.id = v.cliente_id
      WHERE v.tenant_id = $1::bigint
        AND ($2::bigint IS NULL OR v.sede_id = $2::bigint)
        AND ($3::bigint IS NULL OR v.vendedor_id = $3::bigint)
        AND v.estado IN ('pendiente_pago','parcial') AND v.saldo > 0
      ORDER BY dias_antiguedad DESC, v.saldo DESC`,
    tenantId,
    sedeId,
    vendedorId ?? null,
  );
}

export function resumirCartera(filas: FilaCartera[]) {
  let totalSaldo = 0;
  const porTramo = new Map<string, { cuentas: number; saldo: number }>();
  for (const f of filas) {
    const s = Number(f.saldo);
    totalSaldo += s;
    const cur = porTramo.get(f.tramo) ?? { cuentas: 0, saldo: 0 };
    cur.cuentas += 1;
    cur.saldo += s;
    porTramo.set(f.tramo, cur);
  }
  return { totalSaldo, cuentas: filas.length, porTramo: [...porTramo.entries()].map(([tramo, v]) => ({ tramo, ...v })) };
}
