// Consulta pública de clientes (sin login): por código de venta muestra el
// estado de la compra, sus boletas y si resultó ganadora. El código de venta
// (VTA-AAAA-NNNNNN) es único globalmente y actúa como clave de consulta.
import "server-only";
import { prisma } from "@/lib/prisma";

export async function consultarVenta(codigo: string) {
  const c = codigo.trim().toUpperCase();
  if (!c) return null;

  const venta = await prisma.ventas.findFirst({
    where: { codigo: c },
    include: {
      clientes: { select: { nombre: true } },
      tenants: { select: { nombre: true } },
      rifas: { select: { codigo: true, nombre: true, estado: true, fecha_sorteo: true } },
      ventas_boletas: { include: { boletas: { select: { id: true, numero: true, estado: true } } } },
    },
  });
  if (!venta) return null;

  const boletaIds = venta.ventas_boletas.map((vb) => vb.boletas.id);
  const ganadores = boletaIds.length
    ? await prisma.ganadores.findMany({
        where: { boleta_id: { in: boletaIds } },
        include: { premios: { select: { nombre: true } }, boletas: { select: { numero: true } } },
      })
    : [];

  return {
    empresa: venta.tenants.nombre,
    cliente: venta.clientes.nombre,
    codigo: venta.codigo,
    estado: venta.estado,
    total: venta.total.toString(),
    saldo: venta.saldo.toString(),
    rifa: venta.rifas,
    numeros: venta.ventas_boletas.map((vb) => vb.boletas.numero).sort((a, b) => a - b),
    ganadores: ganadores.map((g) => ({ numero: g.boletas?.numero ?? null, premio: g.premios?.nombre ?? "Premio", estado_entrega: g.estado_entrega })),
  };
}
