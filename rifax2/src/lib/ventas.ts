// Servicio de ventas. Replica las reglas del RIFAX API original.
//
// Garantías anti-doble-venta (tres barreras):
//  1. Bloqueo pesimista: SELECT ... FOR UPDATE sobre las boletas objetivo.
//  2. Validación de estado 'disponible' dentro de la transacción.
//  3. Restricción UNIQUE(boleta_id) en ventas_boletas (última barrera en BD).
//
// Además: idempotencia por Idempotency-Key y patrón outbox (la notificación se
// encola en la MISMA transacción que el evento de negocio).
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

export const crearVentaSchema = z.object({
  rifa_id: z.coerce.bigint(),
  numeros: z.array(z.number().int().nonnegative()).min(1, "Indica al menos una boleta."),
  cliente: z.object({
    nombre: z.string().min(2, "Nombre del cliente muy corto."),
    telefono: z.string().min(7, "Teléfono inválido."),
    correo: z.string().email("Correo inválido.").optional(),
    documento: z.string().optional(),
    consentimiento_datos: z.boolean().optional(),
  }),
  vendedor_id: z.coerce.bigint().optional(),
  canal: z.enum(["web", "whatsapp", "vendedor", "pos"]).default("web"),
});

export type CrearVentaInput = z.input<typeof crearVentaSchema>;

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listarVentas() {
  return prisma.ventas.findMany({
    orderBy: { id: "desc" },
    include: { clientes: true, rifas: { select: { codigo: true, nombre: true } } },
    take: 100,
  });
}

export async function obtenerVenta(id: bigint) {
  const venta = await prisma.ventas.findUnique({
    where: { id },
    include: {
      clientes: true,
      rifas: { select: { codigo: true, nombre: true, precio_boleta: true } },
      abonos: { orderBy: { id: "asc" } },
      ventas_boletas: { include: { boletas: true } },
    },
  });
  return venta;
}

/** Primeros N números disponibles de una rifa (ayuda para armar la venta). */
export async function boletasDisponibles(rifaId: bigint, limite = 20) {
  const filas = await prisma.boletas.findMany({
    where: { rifa_id: rifaId, estado: "disponible" },
    select: { numero: true },
    orderBy: { numero: "asc" },
    take: limite,
  });
  return filas.map((f) => f.numero);
}

export async function crearVenta(
  input: unknown,
  actorId: bigint | null,
  idempotencyKey?: string | null,
): Promise<Resultado<{ ventaId: bigint; codigo: string; total: string; idempotente: boolean }>> {
  const parsed = crearVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de venta inválidos." };
  }
  const d = parsed.data;

  // Números duplicados en la misma petición romperían UNIQUE(boleta_id).
  const numeros = [...new Set(d.numeros)];

  // 1) Idempotencia: si la clave ya existe, devuelve la venta previa.
  if (idempotencyKey) {
    const previa = await prisma.ventas.findFirst({ where: { idempotency_key: idempotencyKey } });
    if (previa) {
      return {
        ok: true,
        data: {
          ventaId: previa.id,
          codigo: previa.codigo,
          total: previa.total.toString(),
          idempotente: true,
        },
      };
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 2) La rifa debe estar activa.
      const rifa = await tx.rifas.findUnique({ where: { id: d.rifa_id } });
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      if (rifa.estado !== "activa") {
        return { ok: false as const, error: `La rifa no está activa (estado: ${rifa.estado}).` };
      }

      // 3) Bloqueo pesimista de las boletas objetivo.
      const boletas = await tx.$queryRawUnsafe<
        { id: bigint; numero: number; estado: string }[]
      >(
        `SELECT id, numero, estado FROM boletas
          WHERE rifa_id = $1::bigint AND numero = ANY($2::int[])
          ORDER BY numero
          FOR UPDATE`,
        d.rifa_id,
        numeros,
      );

      if (boletas.length !== numeros.length) {
        const encontrados = new Set(boletas.map((b) => b.numero));
        const faltantes = numeros.filter((n) => !encontrados.has(n));
        return {
          ok: false as const,
          error: `Números fuera de rango o inexistentes: ${faltantes.join(", ")}.`,
        };
      }

      const ocupadas = boletas.filter((b) => b.estado !== "disponible").map((b) => b.numero);
      if (ocupadas.length) {
        return { ok: false as const, error: `Boletas no disponibles: ${ocupadas.join(", ")}.` };
      }

      // 4) Cliente (upsert por teléfono, respetando el consentimiento previo).
      const cliente = await tx.clientes.upsert({
        where: { telefono: d.cliente.telefono },
        create: {
          nombre: d.cliente.nombre,
          telefono: d.cliente.telefono,
          correo: d.cliente.correo ?? null,
          documento: d.cliente.documento ?? null,
          consentimiento_datos: d.cliente.consentimiento_datos ?? false,
        },
        update: {
          nombre: d.cliente.nombre,
          ...(d.cliente.correo ? { correo: d.cliente.correo } : {}),
        },
      });

      // 5) Venta. El código depende del id, así que se usa un temporal ÚNICO
      //    (el original usaba el literal 'TMP', que colisiona con UNIQUE).
      const precio = rifa.precio_boleta;
      const total = precio.mul(numeros.length);

      const creada = await tx.ventas.create({
        data: {
          codigo: `TMP-${randomUUID()}`,
          rifa_id: d.rifa_id,
          cliente_id: cliente.id,
          vendedor_id: d.vendedor_id ?? null,
          cantidad: numeros.length,
          total,
          saldo: total,
          estado: "pendiente_pago",
          canal: d.canal,
          idempotency_key: idempotencyKey ?? null,
          expira_en: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      const codigo = `VTA-${new Date().getFullYear()}-${String(creada.id).padStart(6, "0")}`;
      await tx.ventas.update({ where: { id: creada.id }, data: { codigo } });

      // 6) Detalle venta<->boleta. UNIQUE(boleta_id) impide la doble venta.
      await tx.ventas_boletas.createMany({
        data: boletas.map((b) => ({ venta_id: creada.id, boleta_id: b.id, precio })),
      });

      // 7) Reservar boletas (incrementa `version`: bloqueo optimista).
      await tx.$executeRawUnsafe(
        `UPDATE boletas
            SET estado='reservada', venta_id=$1::bigint, version=version+1, actualizado_en=now()
          WHERE rifa_id=$2::bigint AND numero = ANY($3::int[])`,
        creada.id,
        d.rifa_id,
        numeros,
      );

      // 8) Outbox en la misma transacción.
      await tx.outbox_notificaciones.create({
        data: {
          evento: "venta.creada",
          payload: { venta_id: String(creada.id), codigo },
          canal: "whatsapp",
        },
      });

      // 9) Auditoría.
      await auditar(tx, {
        actorId,
        accion: "venta.crear",
        entidadTipo: "venta",
        entidadId: creada.id,
        despues: {
          id: String(creada.id),
          codigo,
          cantidad: numeros.length,
          total: total.toString(),
          estado: "pendiente_pago",
        },
      });

      return {
        ok: true as const,
        data: {
          ventaId: creada.id,
          codigo,
          total: total.toString(),
          idempotente: false,
        },
      };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la venta." };
  }
}

export async function registrarAbono(
  ventaId: bigint,
  datos: { monto: number | string; origen?: "pasarela" | "comprobante" | "efectivo" | "ajuste" },
  actorId: bigint | null,
): Promise<Resultado<{ saldo: string; estado: string }>> {
  if (!(Number(datos.monto) > 0)) return { ok: false, error: "El monto debe ser positivo." };

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; saldo: string; estado: string }[]>(
        `SELECT id, saldo::text AS saldo, estado FROM ventas WHERE id = $1::bigint FOR UPDATE`,
        ventaId,
      );
      const venta = filas[0];
      if (!venta) return { ok: false as const, error: "Venta no encontrada." };
      if (venta.estado === "anulada" || venta.estado === "pagada") {
        return { ok: false as const, error: `La venta está '${venta.estado}'.` };
      }

      // Aritmética monetaria EXACTA: se hace en Postgres sobre NUMERIC, no con
      // el float de JavaScript. `saldo` es NUMERIC(14,2) y restar en `number`
      // puede introducir error de redondeo en montos con centavos.
      // El monto viaja como texto para no perder precisión al pasar por JS.
      const montoTexto = String(datos.monto);

      await tx.$executeRawUnsafe(
        `INSERT INTO abonos (venta_id, origen, monto, registrado_por)
         VALUES ($1::bigint, $2::text, $3::numeric, $4::bigint)`,
        ventaId,
        datos.origen ?? "efectivo",
        montoTexto,
        actorId,
      );

      // En un UPDATE, las referencias a `saldo` en SET/CASE usan el valor
      // ANTERIOR de la fila, así que ambas expresiones son consistentes.
      const actualizadas = await tx.$queryRawUnsafe<{ saldo: string; estado: string }[]>(
        `UPDATE ventas
            SET saldo  = GREATEST(saldo - $2::numeric, 0),
                estado = CASE WHEN saldo - $2::numeric <= 0 THEN 'pagada' ELSE 'parcial' END
          WHERE id = $1::bigint
        RETURNING saldo::text AS saldo, estado`,
        ventaId,
        montoTexto,
      );
      const nuevoSaldo = actualizadas[0].saldo;
      const nuevoEstado = actualizadas[0].estado;

      // Si quedó saldada, las boletas pasan a 'pagada' y se notifica.
      if (nuevoEstado === "pagada") {
        await tx.boletas.updateMany({
          where: { venta_id: ventaId },
          data: { estado: "pagada", actualizado_en: new Date() },
        });
        await tx.outbox_notificaciones.create({
          data: {
            evento: "venta.pagada",
            payload: { venta_id: String(ventaId) },
            canal: "whatsapp",
          },
        });
      }

      await auditar(tx, {
        actorId,
        accion: "pago.abono",
        entidadTipo: "venta",
        entidadId: ventaId,
        antes: { saldo: venta.saldo, estado: venta.estado },
        despues: { saldo: nuevoSaldo, estado: nuevoEstado },
      });

      return {
        ok: true as const,
        data: { saldo: nuevoSaldo, estado: nuevoEstado },
      };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar el abono." };
  }
}

export async function anularVenta(
  ventaId: bigint,
  motivo: string,
  actorId: bigint | null,
): Promise<Resultado<{ estado: string }>> {
  if (!motivo?.trim()) return { ok: false, error: "El motivo de anulación es obligatorio." };

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; estado: string }[]>(
        `SELECT id, estado FROM ventas WHERE id = $1::bigint FOR UPDATE`,
        ventaId,
      );
      const venta = filas[0];
      if (!venta) return { ok: false as const, error: "Venta no encontrada." };
      if (venta.estado === "anulada") return { ok: false as const, error: "La venta ya está anulada." };

      // Liberar boletas (incrementa `version`) y borrar el detalle.
      await tx.$executeRawUnsafe(
        `UPDATE boletas
            SET estado='disponible', venta_id=NULL, version=version+1, actualizado_en=now()
          WHERE venta_id = $1::bigint`,
        ventaId,
      );
      await tx.ventas_boletas.deleteMany({ where: { venta_id: ventaId } });
      await tx.ventas.update({ where: { id: ventaId }, data: { estado: "anulada" } });

      await auditar(tx, {
        actorId,
        accion: "venta.anular",
        entidadTipo: "venta",
        entidadId: ventaId,
        antes: { estado: venta.estado },
        despues: { estado: "anulada", motivo },
      });

      return { ok: true as const, data: { estado: "anulada" } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al anular la venta." };
  }
}
