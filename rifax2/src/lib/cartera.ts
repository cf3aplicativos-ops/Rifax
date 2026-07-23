// Cartera: consulta la vista `v_cartera` definida en 0001_init.sql, que expone
// las ventas con saldo pendiente clasificadas por tramo de antigüedad/mora.
// Prisma no modela vistas por defecto, así que se consulta con SQL crudo.
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
  al_dia: "Al día",
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

export async function listarCartera(): Promise<FilaCartera[]> {
  return prisma.$queryRawUnsafe<FilaCartera[]>(
    `SELECT c.venta_id,
            v.codigo,
            cl.nombre  AS cliente,
            cl.telefono,
            c.total::text  AS total,
            c.saldo::text  AS saldo,
            c.dias_antiguedad,
            c.tramo
       FROM v_cartera c
       JOIN ventas   v  ON v.id = c.venta_id
       JOIN clientes cl ON cl.id = c.cliente_id
      ORDER BY c.dias_antiguedad DESC, c.saldo DESC`,
  );
}

export interface ResumenCartera {
  totalSaldo: number;
  cuentas: number;
  porTramo: { tramo: string; cuentas: number; saldo: number }[];
}

export function resumirCartera(filas: FilaCartera[]): ResumenCartera {
  const acc = new Map<string, { cuentas: number; saldo: number }>();
  let totalSaldo = 0;
  for (const f of filas) {
    const saldo = Number(f.saldo);
    totalSaldo += saldo;
    const cur = acc.get(f.tramo) ?? { cuentas: 0, saldo: 0 };
    cur.cuentas += 1;
    cur.saldo += saldo;
    acc.set(f.tramo, cur);
  }
  return {
    totalSaldo,
    cuentas: filas.length,
    porTramo: [...acc.entries()].map(([tramo, v]) => ({ tramo, ...v })),
  };
}
