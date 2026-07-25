// Servicio de sorteos y ganadores.
//
// Dos modalidades:
//  - 'externo': el número ganador proviene de una fuente externa (p. ej. lotería
//    nacional); se registra junto a una URL de evidencia.
//  - 'commit_reveal': sorteo verificable. El sistema genera una semilla secreta,
//    publica su hash (commit) y luego la revela; el número ganador se deriva de
//    forma determinista de la semilla, así cualquiera puede recomputarlo y
//    comprobar que no se manipuló.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Deriva el número ganador (dentro de [min, max]) a partir de la semilla.
 * Determinista y reproducible: numero = min + (sha256(semilla) mod rango).
 */
export function derivarNumeroGanador(semilla: string, min: number, max: number): number {
  const rango = BigInt(max - min + 1);
  const hash = createHash("sha256").update(semilla).digest("hex");
  const valor = BigInt("0x" + hash);
  return min + Number(valor % rango);
}

export function hashSemilla(semilla: string): string {
  return createHash("sha256").update(semilla).digest("hex");
}

export async function listarSorteos(rifaId: bigint) {
  return prisma.sorteos.findMany({
    where: { rifa_id: rifaId },
    orderBy: { id: "asc" },
    include: {
      premios: true,
      ganadores: { include: { clientes: true, boletas: true } },
    },
  });
}

export async function premiosPendientes(rifaId: bigint) {
  const [premios, sorteos] = await Promise.all([
    prisma.premios.findMany({ where: { rifa_id: rifaId }, orderBy: { orden: "asc" } }),
    prisma.sorteos.findMany({ where: { rifa_id: rifaId }, select: { premio_id: true } }),
  ]);
  const sorteados = new Set(sorteos.map((s) => String(s.premio_id)));
  return premios.filter((p) => !sorteados.has(String(p.id)));
}

export async function ejecutarSorteo(
  datos: {
    rifaId: bigint;
    premioId: bigint;
    modalidad: "externo" | "commit_reveal";
    numeroGanador?: number;
    evidenciaUrl?: string;
  },
  actorId: bigint | null,
): Promise<Resultado<{ numeroGanador: number; conGanador: boolean }>> {
  const { rifaId, premioId, modalidad } = datos;

  try {
    return await prisma.$transaction(async (tx) => {
      // Bloqueo pesimista de la rifa: no ejecutar dos sorteos a la vez.
      const filas = await tx.$queryRawUnsafe<
        { id: bigint; estado: string; numero_min: number; numero_max: number; codigo: string }[]
      >(
        `SELECT id, estado, numero_min, numero_max, codigo FROM rifas WHERE id = $1::bigint FOR UPDATE`,
        rifaId,
      );
      const rifa = filas[0];
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      if (!["activa", "cerrada", "sorteada"].includes(rifa.estado)) {
        return {
          ok: false as const,
          error: `No se puede sortear una rifa en estado '${rifa.estado}'.`,
        };
      }

      const premio = await tx.premios.findFirst({ where: { id: premioId, rifa_id: rifaId } });
      if (!premio) return { ok: false as const, error: "Premio no encontrado en esta rifa." };

      // UNIQUE(rifa_id, premio_id) en sorteos evita sortear dos veces el premio,
      // pero validamos antes para dar un mensaje claro.
      const yaSorteado = await tx.sorteos.findFirst({
        where: { rifa_id: rifaId, premio_id: premioId },
      });
      if (yaSorteado) return { ok: false as const, error: "Este premio ya fue sorteado." };

      let numeroGanador: number;
      let commitHash: string | null = null;
      let semilla: string | null = null;

      if (modalidad === "commit_reveal") {
        semilla = randomBytes(32).toString("hex");
        commitHash = hashSemilla(semilla);
        numeroGanador = derivarNumeroGanador(semilla, rifa.numero_min, rifa.numero_max);
      } else {
        if (
          datos.numeroGanador === undefined ||
          !Number.isInteger(datos.numeroGanador) ||
          datos.numeroGanador < rifa.numero_min ||
          datos.numeroGanador > rifa.numero_max
        ) {
          return {
            ok: false as const,
            error: `El número ganador debe estar entre ${rifa.numero_min} y ${rifa.numero_max}.`,
          };
        }
        numeroGanador = datos.numeroGanador;
      }

      const sorteo = await tx.sorteos.create({
        data: {
          rifa_id: rifaId,
          modalidad,
          numero_ganador: numeroGanador,
          premio_id: premioId,
          commit_hash: commitHash,
          semilla,
          evidencia_url: datos.evidenciaUrl || null,
          ejecutado_por: actorId,
        },
      });

      // Buscar la boleta ganadora y, si fue vendida, su cliente.
      const boleta = await tx.boletas.findFirst({
        where: { rifa_id: rifaId, numero: numeroGanador },
        include: { ventas: { include: { clientes: true } } },
      });

      let conGanador = false;
      if (boleta) {
        // Solo hay ganador con nombre si la boleta está pagada.
        const clienteId =
          boleta.estado === "pagada" && boleta.ventas?.clientes
            ? boleta.ventas.clientes.id
            : null;
        conGanador = clienteId !== null;

        await tx.ganadores.create({
          data: {
            sorteo_id: sorteo.id,
            rifa_id: rifaId,
            boleta_id: boleta.id,
            cliente_id: clienteId,
            premio_id: premioId,
            estado_entrega: "pendiente",
          },
        });
      }

      // Si ya no quedan premios por sortear, la rifa pasa a 'sorteada'.
      const totalPremios = await tx.premios.count({ where: { rifa_id: rifaId } });
      const totalSorteos = await tx.sorteos.count({ where: { rifa_id: rifaId } });
      if (totalSorteos >= totalPremios && rifa.estado !== "sorteada") {
        await tx.rifas.update({ where: { id: rifaId }, data: { estado: "sorteada" } });
      }

      await auditar(tx, {
        actorId,
        accion: "sorteo.ejecutar",
        entidadTipo: "sorteo",
        entidadId: sorteo.id,
        despues: {
          rifa: rifa.codigo,
          premio: premio.nombre,
          modalidad,
          numero_ganador: numeroGanador,
          commit_hash: commitHash,
          con_ganador: conGanador,
        },
      });

      return { ok: true as const, data: { numeroGanador, conGanador } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al ejecutar el sorteo." };
  }
}

export async function cambiarEntregaGanador(
  ganadorId: bigint,
  estado: string,
  actorId: bigint | null,
): Promise<Resultado> {
  if (!["pendiente", "contactado", "entregado", "no_reclamado"].includes(estado)) {
    return { ok: false, error: "Estado de entrega inválido." };
  }
  const ganador = await prisma.ganadores.findUnique({ where: { id: ganadorId } });
  if (!ganador) return { ok: false, error: "Ganador no encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.ganadores.update({ where: { id: ganadorId }, data: { estado_entrega: estado } });
    await auditar(tx, {
      actorId,
      accion: "sorteo.ejecutar",
      entidadTipo: "ganador",
      entidadId: ganadorId,
      antes: { estado_entrega: ganador.estado_entrega },
      despues: { estado_entrega: estado },
    });
  });
  return { ok: true };
}
