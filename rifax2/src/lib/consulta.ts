// Consulta pública de clientes (sin login). Para garantizar que cada quien solo
// vea SU información (#4), se valida por documento + teléfono. Devuelve el estado
// de cuenta completo: todas sus compras, boletas, saldos y premios ganados.
import "server-only";
import { prisma } from "@/lib/prisma";

export interface CompraCliente {
  empresa: string;
  codigo: string;
  rifa: string;
  rifaEstado: string;
  fechaSorteo: string;
  total: string;
  saldo: string;
  estado: string;
  numeros: number[];
  ganados: { numero: number | null; premio: string; entrega: string }[];
}

export interface EstadoCuenta {
  cliente: string;
  documento: string;
  compras: CompraCliente[];
  totalComprado: string;
  totalSaldo: string;
}

export async function consultarEstadoCuenta(documento: string, telefono: string): Promise<EstadoCuenta | null> {
  const doc = documento.trim();
  const tel = telefono.trim();
  if (!doc || !tel) return null;

  // Valida por documento Y teléfono: ambos deben coincidir.
  const clientes = await prisma.clientes.findMany({
    where: { documento: doc, telefono: tel },
    include: {
      tenants: { select: { nombre: true } },
      ventas: {
        orderBy: { id: "desc" },
        include: {
          rifas: { select: { nombre: true, estado: true, fecha_sorteo: true } },
          ventas_boletas: { include: { boletas: { select: { id: true, numero: true } } } },
        },
      },
    },
  });
  if (clientes.length === 0) return null;

  const compras: CompraCliente[] = [];
  let totalComprado = 0;
  let totalSaldo = 0;

  for (const cl of clientes) {
    for (const v of cl.ventas) {
      const boletaIds = v.ventas_boletas.map((vb) => vb.boletas.id);
      const ganadores = boletaIds.length
        ? await prisma.ganadores.findMany({
            where: { boleta_id: { in: boletaIds } },
            include: { premios: { select: { nombre: true } }, boletas: { select: { numero: true } } },
          })
        : [];
      totalComprado += Number(v.total.toString());
      totalSaldo += Number(v.saldo.toString());
      compras.push({
        empresa: cl.tenants.nombre,
        codigo: v.codigo,
        rifa: v.rifas.nombre,
        rifaEstado: v.rifas.estado,
        fechaSorteo: v.rifas.fecha_sorteo.toISOString().slice(0, 10),
        total: v.total.toString(),
        saldo: v.saldo.toString(),
        estado: v.estado,
        numeros: v.ventas_boletas.map((vb) => vb.boletas.numero).sort((a, b) => a - b),
        ganados: ganadores.map((g) => ({ numero: g.boletas?.numero ?? null, premio: g.premios?.nombre ?? "Premio", entrega: g.estado_entrega })),
      });
    }
  }

  return {
    cliente: clientes[0].nombre,
    documento: doc,
    compras,
    totalComprado: String(totalComprado),
    totalSaldo: String(totalSaldo),
  };
}
