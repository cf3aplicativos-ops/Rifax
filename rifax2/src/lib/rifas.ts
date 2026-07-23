// Servicio de rifas. Replica las reglas del RIFAX API original:
//  - Al CREAR: la rifa nace en 'borrador'. numero_max = 10^digitos - 1.
//  - Al PUBLICAR: se materializan todas las boletas del rango (generate_series,
//    idempotente) y la rifa pasa a 'activa'.
// Todo evento queda en la auditoría con hash encadenado.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

export const crearRifaSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().optional(),
  numero_digitos: z.coerce.number().int().min(2).max(6),
  precio_boleta: z.coerce.number().positive("El precio debe ser mayor que 0."),
  fecha_apertura: z.string().min(1, "Indica la fecha de apertura."),
  fecha_cierre_ventas: z.string().min(1, "Indica el cierre de ventas."),
  fecha_sorteo: z.string().min(1, "Indica la fecha del sorteo."),
  tasa_derechos: z.coerce.number().min(0).max(1).optional(),
});

export type CrearRifaInput = z.input<typeof crearRifaSchema>;

export async function listarRifas() {
  return prisma.rifas.findMany({ orderBy: { id: "desc" } });
}

export async function obtenerRifa(id: bigint) {
  return prisma.rifas.findUnique({
    where: { id },
    include: { premios: { orderBy: { orden: "asc" } } },
  });
}

export async function crearRifa(input: unknown, actorId: bigint | null) {
  const parsed = crearRifaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  const apertura = new Date(d.fecha_apertura);
  const cierre = new Date(d.fecha_cierre_ventas);
  const sorteo = new Date(d.fecha_sorteo);
  if (cierre > sorteo) {
    return { ok: false as const, error: "El cierre de ventas debe ser anterior o igual al sorteo." };
  }

  const numeroMax = Math.pow(10, d.numero_digitos) - 1;
  const totalBoletas = numeroMax + 1;

  const rifa = await prisma.$transaction(async (tx) => {
    // El código definitivo depende del id (aún desconocido), así que se inserta
    // con un temporal ÚNICO. El original usaba el literal 'TMP', que colisiona
    // con la restricción UNIQUE si se crean dos rifas a la vez.
    const creada = await tx.rifas.create({
      data: {
        codigo: `TMP-${randomUUID()}`,
        nombre: d.nombre,
        descripcion: d.descripcion || null,
        numero_digitos: d.numero_digitos,
        numero_min: 0,
        numero_max: numeroMax,
        precio_boleta: d.precio_boleta,
        fecha_apertura: apertura,
        fecha_cierre_ventas: cierre,
        fecha_sorteo: sorteo,
        tasa_derechos: d.tasa_derechos ?? 0.14,
        total_boletas: totalBoletas,
        creado_por: actorId,
      },
    });

    const codigo = `RFX-${new Date().getFullYear()}-${String(creada.id).padStart(4, "0")}`;
    const actualizada = await tx.rifas.update({
      where: { id: creada.id },
      data: { codigo },
    });

    await auditar(tx, {
      actorId,
      accion: "rifa.crear",
      entidadTipo: "rifa",
      entidadId: creada.id,
      despues: {
        id: String(creada.id),
        codigo,
        nombre: d.nombre,
        estado: actualizada.estado,
        total_boletas: totalBoletas,
      },
    });

    return actualizada;
  }, { maxWait: 15_000, timeout: 30_000 });

  return { ok: true as const, rifa };
}

export async function publicarRifa(rifaId: bigint, actorId: bigint | null) {
  try {
    const resultado = await prisma.$transaction(
      async (tx) => {
        // Bloqueo pesimista para evitar publicaciones concurrentes.
        const rows = await tx.$queryRawUnsafe<
          { id: bigint; estado: string; numero_min: number; numero_max: number }[]
        >(`SELECT id, estado, numero_min, numero_max FROM rifas WHERE id = $1::bigint FOR UPDATE`, rifaId);

        const rifa = rows[0];
        if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
        if (rifa.estado !== "borrador") {
          return {
            ok: false as const,
            error: `No se puede publicar una rifa en estado '${rifa.estado}'.`,
          };
        }

        // Materialización en lote e idempotente de todas las boletas.
        await tx.$executeRawUnsafe(
          `INSERT INTO boletas (rifa_id, numero)
           SELECT $1::bigint, g FROM generate_series($2::int, $3::int) AS g
           ON CONFLICT (rifa_id, numero) DO NOTHING`,
          rifaId,
          rifa.numero_min,
          rifa.numero_max,
        );

        await tx.rifas.update({ where: { id: rifaId }, data: { estado: "activa" } });
        const boletas = await tx.boletas.count({ where: { rifa_id: rifaId } });

        await auditar(tx, {
          actorId,
          accion: "rifa.publicar",
          entidadTipo: "rifa",
          entidadId: rifaId,
          antes: { estado: "borrador" },
          despues: { estado: "activa", boletas },
        });

        return { ok: true as const, boletas };
      },
      // Materializar rangos grandes (hasta 10^6 boletas) puede tardar.
      { timeout: 120_000, maxWait: 10_000 },
    );
    return resultado;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error al publicar." };
  }
}
