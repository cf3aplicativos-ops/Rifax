// Servicio de rifas (multi-tenant). Toda consulta se filtra por tenant; el SQL
// crudo se cualifica saas.*. Cada rifa pertenece a una sede.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

export const crearRifaSchema = z.object({
  sede_id: z.coerce.bigint(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().optional(),
  loteria: z.string().optional(),
  numero_digitos: z.coerce.number().int().min(2).max(6),
  precio_boleta: z.coerce.number().positive("El precio debe ser mayor que 0."),
  fecha_apertura: z.string().min(1, "Indica la fecha de apertura."),
  fecha_cierre_ventas: z.string().min(1, "Indica el cierre de ventas."),
  fecha_sorteo: z.string().min(1, "Indica la fecha del sorteo."),
  tasa_derechos: z.coerce.number().min(0).max(1).optional(),
});

/** Sedes que un usuario puede operar: la suya si está acotado, o todas las activas. */
export async function sedesOperables(tenantId: bigint, sedeId: bigint | null) {
  return prisma.sedes.findMany({
    where: { tenant_id: tenantId, estado: "activa", ...(sedeId ? { id: sedeId } : {}) },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

export async function listarRifas(tenantId: bigint, sedeId: bigint | null) {
  return prisma.rifas.findMany({
    where: { tenant_id: tenantId, ...(sedeId ? { sede_id: sedeId } : {}) },
    orderBy: { id: "desc" },
    include: { sedes: { select: { nombre: true } } },
  });
}

export async function obtenerRifa(tenantId: bigint, id: bigint) {
  return prisma.rifas.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      premios: { orderBy: { orden: "asc" } },
      premios_anticipados: { orderBy: { fecha_juego: "asc" } },
      sedes: { select: { nombre: true } },
    },
  });
}

export async function agregarPremioAnticipado(
  tenantId: bigint,
  rifaId: bigint,
  datos: { nombre: string; loteria?: string; fecha_juego: string; pagos_requeridos?: number; valor_estimado?: number | null },
  actorId: bigint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!datos.nombre?.trim()) return { ok: false, error: "El nombre del premio es obligatorio." };
  if (!datos.fecha_juego) return { ok: false, error: "La fecha de juego es obligatoria." };
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  try {
    await prisma.$transaction(async (tx) => {
      const p = await tx.premios_anticipados.create({
        data: {
          tenant_id: tenantId,
          rifa_id: rifaId,
          nombre: datos.nombre.trim(),
          loteria: datos.loteria || null,
          fecha_juego: new Date(datos.fecha_juego),
          pagos_requeridos: datos.pagos_requeridos && datos.pagos_requeridos >= 1 ? datos.pagos_requeridos : 1,
          valor_estimado: datos.valor_estimado ?? null,
          estado: "programado",
        },
      });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio_anticipado", entidadId: p.id, despues: { rifa: rifa.codigo, nombre: datos.nombre.trim(), fecha: datos.fecha_juego } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al agregar el premio anticipado." };
  }
}

export async function agregarPremio(
  tenantId: bigint,
  rifaId: bigint,
  datos: { nombre: string; valorEstimado?: number | null },
  actorId: bigint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!datos.nombre?.trim()) return { ok: false, error: "El nombre del premio es obligatorio." };
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  if (["sorteada", "liquidada", "archivada"].includes(rifa.estado)) {
    return { ok: false, error: `No se pueden agregar premios a una rifa '${rifa.estado}'.` };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const max = await tx.premios.aggregate({ where: { rifa_id: rifaId }, _max: { orden: true } });
      const premio = await tx.premios.create({
        data: { rifa_id: rifaId, orden: (max._max.orden ?? 0) + 1, nombre: datos.nombre.trim(), valor_estimado: datos.valorEstimado ?? null },
      });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio", entidadId: premio.id, despues: { rifa: rifa.codigo, nombre: datos.nombre.trim() } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al agregar el premio." };
  }
}

export async function crearRifa(
  input: unknown,
  tenantId: bigint,
  sedeIdUsuario: bigint | null,
  actorId: bigint,
) {
  const parsed = crearRifaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  // La sede debe pertenecer al tenant y estar permitida para el usuario.
  const sede = await prisma.sedes.findFirst({
    where: {
      id: d.sede_id,
      tenant_id: tenantId,
      estado: "activa",
      ...(sedeIdUsuario ? { id: sedeIdUsuario } : {}),
    },
  });
  if (!sede) return { ok: false as const, error: "Sede inválida o no permitida." };

  const cierre = new Date(d.fecha_cierre_ventas);
  const sorteo = new Date(d.fecha_sorteo);
  if (cierre > sorteo) {
    return { ok: false as const, error: "El cierre de ventas debe ser anterior o igual al sorteo." };
  }

  const numeroMax = Math.pow(10, d.numero_digitos) - 1;

  const rifa = await prisma.$transaction(async (tx) => {
    const creada = await tx.rifas.create({
      data: {
        tenant_id: tenantId,
        sede_id: d.sede_id,
        codigo: `TMP-${randomUUID()}`,
        nombre: d.nombre,
        descripcion: d.descripcion || null,
        loteria: d.loteria || null,
        numero_digitos: d.numero_digitos,
        numero_min: 0,
        numero_max: numeroMax,
        precio_boleta: d.precio_boleta,
        fecha_apertura: new Date(d.fecha_apertura),
        fecha_cierre_ventas: cierre,
        fecha_sorteo: sorteo,
        tasa_derechos: d.tasa_derechos ?? 0.14,
        total_boletas: numeroMax + 1,
        creado_por: actorId,
      },
    });
    const codigo = `RFX-${new Date().getFullYear()}-${String(creada.id).padStart(4, "0")}`;
    const actualizada = await tx.rifas.update({ where: { id: creada.id }, data: { codigo } });

    await auditar(tx, {
      tenantId,
      actorId,
      accion: "rifa.crear",
      entidadTipo: "rifa",
      entidadId: creada.id,
      despues: { codigo, nombre: d.nombre, sede: sede.nombre, total_boletas: numeroMax + 1 },
    });
    return actualizada;
  }, { maxWait: 15_000, timeout: 30_000 });

  return { ok: true as const, rifa };
}

export async function publicarRifa(tenantId: bigint, rifaId: bigint, actorId: bigint) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRawUnsafe<
          { id: bigint; estado: string; numero_min: number; numero_max: number }[]
        >(
          `SELECT id, estado, numero_min, numero_max FROM saas.rifas
            WHERE id = $1::bigint AND tenant_id = $2::bigint FOR UPDATE`,
          rifaId,
          tenantId,
        );
        const rifa = rows[0];
        if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
        if (rifa.estado !== "borrador") {
          return { ok: false as const, error: `No se puede publicar una rifa en estado '${rifa.estado}'.` };
        }

        // Materializa las boletas del rango (idempotente), con tenant_id.
        await tx.$executeRawUnsafe(
          `INSERT INTO saas.boletas (tenant_id, rifa_id, numero)
           SELECT $1::bigint, $2::bigint, g FROM generate_series($3::int, $4::int) AS g
           ON CONFLICT (rifa_id, numero) DO NOTHING`,
          tenantId,
          rifaId,
          rifa.numero_min,
          rifa.numero_max,
        );
        await tx.rifas.update({ where: { id: rifaId }, data: { estado: "activa" } });
        const boletas = await tx.boletas.count({ where: { rifa_id: rifaId } });

        await auditar(tx, {
          tenantId,
          actorId,
          accion: "rifa.publicar",
          entidadTipo: "rifa",
          entidadId: rifaId,
          antes: { estado: "borrador" },
          despues: { estado: "activa", boletas },
        });
        return { ok: true as const, boletas };
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error al publicar." };
  }
}
