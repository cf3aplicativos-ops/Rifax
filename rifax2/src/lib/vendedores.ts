// Servicio de vendedores y talonarios (multi-tenant). Filtra por tenant_id;
// asignación de talonarios serializada por tenant (advisory lock) para evitar
// rangos solapados. SQL crudo cualificado saas.*.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const crearVendedorSchema = z.object({
  sede_id: z.coerce.bigint().optional(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  documento: z.string().min(3, "El documento es obligatorio."),
  telefono: z.string().min(7, "Teléfono inválido."),
  correo: z.string().email("Correo inválido.").optional(),
  pct_comision: z.coerce.number().min(0).max(100).optional(),
  cupo_max: z.coerce.number().int().positive().optional(),
});

export async function listarVendedores(tenantId: bigint) {
  return prisma.vendedores.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "desc" },
    include: { _count: { select: { talonarios: true, ventas: true } } },
  });
}

export async function obtenerVendedor(tenantId: bigint, id: bigint) {
  return prisma.vendedores.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      talonarios: { orderBy: { id: "desc" }, include: { rifas: { select: { codigo: true, nombre: true } } } },
    },
  });
}

export async function crearVendedor(input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = crearVendedorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const v = await tx.vendedores.create({
        data: {
          tenant_id: tenantId,
          sede_id: d.sede_id ?? null,
          nombre: d.nombre,
          documento: d.documento,
          telefono: d.telefono,
          correo: d.correo ?? null,
          pct_comision: d.pct_comision ?? 0,
          cupo_max: d.cupo_max ?? null,
          estado: "activo",
        },
      });
      await auditar(tx, { tenantId, actorId, accion: "vendedor.crear", entidadTipo: "vendedor", entidadId: v.id, despues: { nombre: d.nombre, documento: d.documento } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el vendedor." };
  }
}

export async function cambiarEstadoVendedor(vendedorId: bigint, tenantId: bigint, estado: string, actorId: bigint): Promise<Resultado> {
  if (!["activo", "suspendido", "inactivo"].includes(estado)) return { ok: false, error: "Estado inválido." };
  const v = await prisma.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
  if (!v) return { ok: false, error: "Vendedor no encontrado." };
  await prisma.$transaction(async (tx) => {
    await tx.vendedores.update({ where: { id: vendedorId }, data: { estado } });
    await auditar(tx, { tenantId, actorId, accion: "vendedor.editar", entidadTipo: "vendedor", entidadId: vendedorId, antes: { estado: v.estado }, despues: { estado } });
  });
  return { ok: true };
}

export async function asignarTalonario(
  datos: { rifaId: bigint; vendedorId: bigint; tipo: "consecutiva" | "aleatoria"; inicio?: number; fin?: number; cantidad?: number },
  tenantId: bigint,
  actorId: bigint,
): Promise<Resultado<{ boletas: number }>> {
  const { rifaId, vendedorId, tipo } = datos;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('talonarios_rifa_' || $1::text))`, String(rifaId));

      const rifa = await tx.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      const vendedor = await tx.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
      if (!vendedor) return { ok: false as const, error: "Vendedor no encontrado." };
      if (vendedor.estado !== "activo") return { ok: false as const, error: `El vendedor está '${vendedor.estado}'.` };

      // Cupo del vendedor (aplica a ambos modos).
      const cantidadPedida = tipo === "consecutiva" ? (datos.fin ?? 0) - (datos.inicio ?? 0) + 1 : datos.cantidad ?? 0;
      if (cantidadPedida < 1) return { ok: false as const, error: "Indica una cantidad válida de boletas." };
      if (vendedor.cupo_max !== null) {
        const asignadas = await tx.talonarios.findMany({ where: { vendedor_id: vendedorId, estado: { not: "cerrado" } }, select: { numero_inicio: true, numero_fin: true } });
        const ya = asignadas.reduce((a, t) => a + (t.numero_fin - t.numero_inicio + 1), 0);
        if (ya + cantidadPedida > vendedor.cupo_max) return { ok: false as const, error: `Excede el cupo del vendedor (${vendedor.cupo_max}); ya tiene ${ya}.` };
      }

      let inicio: number;
      let fin: number;
      let marcadas: number;

      if (tipo === "consecutiva") {
        inicio = datos.inicio ?? 0;
        fin = datos.fin ?? 0;
        if (!Number.isInteger(inicio) || !Number.isInteger(fin) || fin < inicio) return { ok: false as const, error: "Rango inválido." };
        if (inicio < rifa.numero_min || fin > rifa.numero_max) return { ok: false as const, error: `El rango debe estar entre ${rifa.numero_min} y ${rifa.numero_max}.` };
        const solapados = await tx.talonarios.findMany({ where: { rifa_id: rifaId, estado: { not: "cerrado" }, numero_inicio: { lte: fin }, numero_fin: { gte: inicio } }, select: { numero_inicio: true, numero_fin: true } });
        if (solapados.length) { const r = solapados[0]; return { ok: false as const, error: `El rango se solapa con un talonario existente (${r.numero_inicio}–${r.numero_fin}).` }; }

        const talonario = await tx.talonarios.create({ data: { tenant_id: tenantId, rifa_id: rifaId, vendedor_id: vendedorId, numero_inicio: inicio, numero_fin: fin, estado: "asignado", tipo: "consecutiva" } });
        marcadas = Number(await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE rifa_id=$2::bigint AND numero BETWEEN $3::int AND $4::int`, talonario.id, rifaId, inicio, fin));
        await auditar(tx, { tenantId, actorId, accion: "talonario.asignar", entidadTipo: "talonario", entidadId: talonario.id, despues: { rifa: rifa.codigo, vendedor: vendedor.nombre, tipo, rango: `${inicio}-${fin}`, boletas: marcadas } });
      } else {
        // Aleatoria: toma N boletas disponibles y sin talonario, al azar.
        const boletas = await tx.$queryRawUnsafe<{ id: bigint; numero: number }[]>(
          `SELECT id, numero FROM saas.boletas
            WHERE rifa_id=$1::bigint AND estado='disponible' AND talonario_id IS NULL
            ORDER BY random() LIMIT $2::int
            FOR UPDATE SKIP LOCKED`,
          rifaId, cantidadPedida,
        );
        if (boletas.length < cantidadPedida) return { ok: false as const, error: `Solo hay ${boletas.length} boletas disponibles para asignar al azar.` };
        const nums = boletas.map((b) => b.numero);
        inicio = Math.min(...nums);
        fin = Math.max(...nums);
        const talonario = await tx.talonarios.create({ data: { tenant_id: tenantId, rifa_id: rifaId, vendedor_id: vendedorId, numero_inicio: inicio, numero_fin: fin, estado: "asignado", tipo: "aleatoria" } });
        await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE id = ANY($2::bigint[])`, talonario.id, boletas.map((b) => b.id));
        marcadas = boletas.length;
        await auditar(tx, { tenantId, actorId, accion: "talonario.asignar", entidadTipo: "talonario", entidadId: talonario.id, despues: { rifa: rifa.codigo, vendedor: vendedor.nombre, tipo, cantidad: marcadas } });
      }

      return { ok: true as const, data: { boletas: marcadas } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al asignar el talonario." };
  }
}

export async function cerrarTalonario(talonarioId: bigint, tenantId: bigint, actorId: bigint): Promise<Resultado<{ liberadas: number }>> {
  try {
    return await prisma.$transaction(async (tx) => {
      const t = await tx.talonarios.findFirst({ where: { id: talonarioId, tenant_id: tenantId } });
      if (!t) return { ok: false as const, error: "Talonario no encontrado." };
      if (t.estado === "cerrado") return { ok: false as const, error: "El talonario ya está cerrado." };
      const liberadas = await tx.$executeRawUnsafe(
        `UPDATE saas.boletas SET talonario_id=NULL WHERE talonario_id=$1::bigint AND estado='disponible'`,
        talonarioId,
      );
      await tx.talonarios.update({ where: { id: talonarioId }, data: { estado: "cerrado" } });
      await auditar(tx, { tenantId, actorId, accion: "talonario.devolver", entidadTipo: "talonario", entidadId: talonarioId, antes: { estado: t.estado }, despues: { estado: "cerrado", liberadas } });
      return { ok: true as const, data: { liberadas: Number(liberadas) } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cerrar el talonario." };
  }
}
