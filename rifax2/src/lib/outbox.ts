// Procesador del outbox de notificaciones (patrón transactional outbox).
//
// Los eventos de negocio encolan filas en outbox_notificaciones dentro de su
// propia transacción. Este procesador las toma y las "entrega". El envío real
// (WhatsApp/SMS/correo) no está integrado todavía, así que se simula; lo que sí
// es real es la mecánica: toma segura ante concurrencia (FOR UPDATE SKIP
// LOCKED), reintentos con backoff exponencial y tope de intentos.
import "server-only";
import { prisma } from "@/lib/prisma";

const MAX_INTENTOS = 5;

export async function resumenOutbox() {
  const filas = await prisma.outbox_notificaciones.groupBy({
    by: ["estado"],
    _count: { _all: true },
  });
  const porEstado: Record<string, number> = {};
  for (const f of filas) porEstado[f.estado] = f._count._all;
  return porEstado;
}

export async function listarOutbox(limite = 50) {
  return prisma.outbox_notificaciones.findMany({
    orderBy: { id: "desc" },
    take: limite,
  });
}

/**
 * Simula la entrega de una notificación. Devuelve true si "se entregó".
 * Aquí se conectaría el proveedor real (WhatsApp Cloud API, SMS, SMTP).
 */
async function entregar(_evento: string, _canal: string, _payload: unknown): Promise<boolean> {
  // Sin proveedor integrado: se considera entregada.
  return true;
}

/**
 * Procesa hasta `lote` notificaciones pendientes cuyo próximo intento ya venció.
 * Devuelve cuántas se enviaron y cuántas fallaron.
 */
export async function procesarOutbox(lote = 20): Promise<{ enviadas: number; fallidas: number }> {
  let enviadas = 0;
  let fallidas = 0;

  for (let i = 0; i < lote; i++) {
    const procesada = await prisma.$transaction(async (tx) => {
      // Toma UNA fila lista y la bloquea; SKIP LOCKED evita que dos procesos
      // tomen la misma. Elegible: pendiente y con proximo_intento vencido (o nulo).
      const filas = await tx.$queryRawUnsafe<
        { id: bigint; evento: string; canal: string; payload: unknown; intentos: number }[]
      >(
        `SELECT id, evento, canal, payload, intentos
           FROM outbox_notificaciones
          WHERE estado = 'pendiente'
            AND (proximo_intento IS NULL OR proximo_intento <= now())
          ORDER BY id
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
      );
      const fila = filas[0];
      if (!fila) return "vacio" as const;

      // Marca 'procesando' para que no la retome otro worker.
      await tx.outbox_notificaciones.update({
        where: { id: fila.id },
        data: { estado: "procesando" },
      });

      let ok = false;
      try {
        ok = await entregar(fila.evento, fila.canal, fila.payload);
      } catch {
        ok = false;
      }

      const intentos = fila.intentos + 1;

      if (ok) {
        await tx.outbox_notificaciones.update({
          where: { id: fila.id },
          data: { estado: "enviado", intentos },
        });
        return "enviada" as const;
      }

      // Falló: reintenta con backoff exponencial (2^intentos minutos) hasta el
      // tope; luego queda 'fallido' para revisión manual.
      if (intentos >= MAX_INTENTOS) {
        await tx.outbox_notificaciones.update({
          where: { id: fila.id },
          data: { estado: "fallido", intentos },
        });
      } else {
        const backoffMin = Math.pow(2, intentos);
        await tx.outbox_notificaciones.update({
          where: { id: fila.id },
          data: {
            estado: "pendiente",
            intentos,
            proximo_intento: new Date(Date.now() + backoffMin * 60_000),
          },
        });
      }
      return "fallida" as const;
    });

    if (procesada === "vacio") break;
    if (procesada === "enviada") enviadas++;
    if (procesada === "fallida") fallidas++;
  }

  return { enviadas, fallidas };
}
