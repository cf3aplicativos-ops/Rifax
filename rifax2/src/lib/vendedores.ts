// Servicio de vendedores y talonarios.
//
// La asignación de talonarios es la parte delicada: dos rangos de la misma rifa
// no pueden solaparse. Verificar el solapamiento con un SELECT no basta, porque
// otra transacción podría insertar un rango en paralelo (lectura fantasma). Se
// serializa por rifa con pg_advisory_xact_lock, el mismo recurso que usa
// registrar_auditoria() para su cadena de hashes.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const crearVendedorSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  documento: z.string().min(3, "El documento es obligatorio."),
  telefono: z.string().min(7, "Teléfono inválido."),
  correo: z.string().email("Correo inválido.").optional(),
  pct_comision: z.coerce.number().min(0).max(100).optional(),
  cupo_max: z.coerce.number().int().positive().optional(),
});

export async function listarVendedores() {
  return prisma.vendedores.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { talonarios: true, ventas: true } } },
  });
}

export async function obtenerVendedor(id: bigint) {
  return prisma.vendedores.findUnique({
    where: { id },
    include: {
      talonarios: {
        orderBy: { id: "desc" },
        include: { rifas: { select: { codigo: true, nombre: true } } },
      },
    },
  });
}

export async function crearVendedor(input: unknown, actorId: bigint | null): Promise<Resultado> {
  const parsed = crearVendedorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const creado = await tx.vendedores.create({
        data: {
          nombre: d.nombre,
          documento: d.documento,
          telefono: d.telefono,
          correo: d.correo ?? null,
          pct_comision: d.pct_comision ?? 0,
          cupo_max: d.cupo_max ?? null,
          estado: "activo",
        },
      });
      await auditar(tx, {
        actorId,
        accion: "vendedor.crear",
        entidadTipo: "vendedor",
        entidadId: creado.id,
        despues: { nombre: d.nombre, documento: d.documento, comision: d.pct_comision ?? 0 },
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el vendedor." };
  }
}

export async function cambiarEstadoVendedor(
  vendedorId: bigint,
  estado: string,
  actorId: bigint | null,
): Promise<Resultado> {
  if (!["activo", "suspendido", "inactivo"].includes(estado)) {
    return { ok: false, error: "Estado inválido." };
  }
  const vendedor = await prisma.vendedores.findUnique({ where: { id: vendedorId } });
  if (!vendedor) return { ok: false, error: "Vendedor no encontrado." };
  if (vendedor.estado === estado) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.vendedores.update({ where: { id: vendedorId }, data: { estado } });
    await auditar(tx, {
      actorId,
      accion: "vendedor.editar",
      entidadTipo: "vendedor",
      entidadId: vendedorId,
      antes: { estado: vendedor.estado },
      despues: { estado },
    });
  });
  return { ok: true };
}

export async function asignarTalonario(
  datos: { rifaId: bigint; vendedorId: bigint; inicio: number; fin: number },
  actorId: bigint | null,
): Promise<Resultado<{ boletas: number }>> {
  const { rifaId, vendedorId, inicio, fin } = datos;

  if (!Number.isInteger(inicio) || !Number.isInteger(fin)) {
    return { ok: false, error: "Los números del rango deben ser enteros." };
  }
  if (fin < inicio) {
    return { ok: false, error: "El número final no puede ser menor que el inicial." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Serializa las asignaciones de esta rifa: evita que dos rangos que se
      // solapan pasen la validación a la vez.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext('talonarios_rifa_' || $1::text))`,
        String(rifaId),
      );

      const rifa = await tx.rifas.findUnique({ where: { id: rifaId } });
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      if (inicio < rifa.numero_min || fin > rifa.numero_max) {
        return {
          ok: false as const,
          error: `El rango debe estar entre ${rifa.numero_min} y ${rifa.numero_max}.`,
        };
      }

      const vendedor = await tx.vendedores.findUnique({ where: { id: vendedorId } });
      if (!vendedor) return { ok: false as const, error: "Vendedor no encontrado." };
      if (vendedor.estado !== "activo") {
        return { ok: false as const, error: `El vendedor está '${vendedor.estado}'.` };
      }

      // Dos rangos [a1,a2] y [b1,b2] se solapan si a1 <= b2 y b1 <= a2.
      const solapados = await tx.talonarios.findMany({
        where: {
          rifa_id: rifaId,
          estado: { not: "cerrado" },
          numero_inicio: { lte: fin },
          numero_fin: { gte: inicio },
        },
        select: { numero_inicio: true, numero_fin: true },
      });
      if (solapados.length) {
        const r = solapados[0];
        return {
          ok: false as const,
          error: `El rango se solapa con un talonario existente (${r.numero_inicio}–${r.numero_fin}).`,
        };
      }

      const cantidad = fin - inicio + 1;

      if (vendedor.cupo_max !== null) {
        const asignadas = await tx.talonarios.findMany({
          where: { vendedor_id: vendedorId, estado: { not: "cerrado" } },
          select: { numero_inicio: true, numero_fin: true },
        });
        const yaAsignadas = asignadas.reduce(
          (acc, t) => acc + (t.numero_fin - t.numero_inicio + 1),
          0,
        );
        if (yaAsignadas + cantidad > vendedor.cupo_max) {
          return {
            ok: false as const,
            error: `Excede el cupo del vendedor (${vendedor.cupo_max}); ya tiene ${yaAsignadas}.`,
          };
        }
      }

      const talonario = await tx.talonarios.create({
        data: {
          rifa_id: rifaId,
          vendedor_id: vendedorId,
          numero_inicio: inicio,
          numero_fin: fin,
          estado: "asignado",
        },
      });

      // Marca las boletas del rango como pertenecientes al talonario.
      const marcadas = await tx.$executeRawUnsafe(
        `UPDATE boletas SET talonario_id = $1::bigint
          WHERE rifa_id = $2::bigint AND numero BETWEEN $3::int AND $4::int`,
        talonario.id,
        rifaId,
        inicio,
        fin,
      );

      await auditar(tx, {
        actorId,
        accion: "talonario.asignar",
        entidadTipo: "talonario",
        entidadId: talonario.id,
        despues: {
          rifa: rifa.codigo,
          vendedor: vendedor.nombre,
          rango: `${inicio}-${fin}`,
          boletas: marcadas,
        },
      });

      return { ok: true as const, data: { boletas: Number(marcadas) } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al asignar el talonario." };
  }
}

/**
 * Cierra un talonario. Las boletas aún disponibles se liberan para poder
 * reasignarlas; las ya vendidas conservan el vínculo, que es la evidencia
 * para la rendición del vendedor.
 */
export async function cerrarTalonario(
  talonarioId: bigint,
  actorId: bigint | null,
): Promise<Resultado<{ liberadas: number }>> {
  try {
    return await prisma.$transaction(async (tx) => {
      const talonario = await tx.talonarios.findUnique({ where: { id: talonarioId } });
      if (!talonario) return { ok: false as const, error: "Talonario no encontrado." };
      if (talonario.estado === "cerrado") {
        return { ok: false as const, error: "El talonario ya está cerrado." };
      }

      const liberadas = await tx.$executeRawUnsafe(
        `UPDATE boletas SET talonario_id = NULL
          WHERE talonario_id = $1::bigint AND estado = 'disponible'`,
        talonarioId,
      );

      await tx.talonarios.update({ where: { id: talonarioId }, data: { estado: "cerrado" } });

      await auditar(tx, {
        actorId,
        accion: "talonario.devolver",
        entidadTipo: "talonario",
        entidadId: talonarioId,
        antes: { estado: talonario.estado },
        despues: { estado: "cerrado", boletas_liberadas: liberadas },
      });

      return { ok: true as const, data: { liberadas: Number(liberadas) } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cerrar el talonario." };
  }
}
