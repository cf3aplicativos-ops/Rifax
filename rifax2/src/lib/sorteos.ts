// Servicio de sorteos y ganadores (multi-tenant). Modalidades 'externo' y
// 'commit_reveal' (verificable). Filtra por tenant; SQL crudo cualificado saas.*.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function derivarNumeroGanador(semilla: string, min: number, max: number): number {
  const rango = BigInt(max - min + 1);
  const valor = BigInt("0x" + createHash("sha256").update(semilla).digest("hex"));
  return min + Number(valor % rango);
}
export function hashSemilla(semilla: string): string {
  return createHash("sha256").update(semilla).digest("hex");
}

export async function listarSorteos(tenantId: bigint, rifaId: bigint) {
  return prisma.sorteos.findMany({
    where: { tenant_id: tenantId, rifa_id: rifaId },
    orderBy: { id: "asc" },
    include: { premios: true, ganadores: { include: { clientes: true, boletas: true } } },
  });
}

export async function premiosPendientes(tenantId: bigint, rifaId: bigint) {
  const [premios, sorteos] = await Promise.all([
    prisma.premios.findMany({ where: { rifa_id: rifaId }, orderBy: { orden: "asc" } }),
    prisma.sorteos.findMany({ where: { tenant_id: tenantId, rifa_id: rifaId }, select: { premio_id: true } }),
  ]);
  const hechos = new Set(sorteos.map((s) => String(s.premio_id)));
  return premios.filter((p) => !hechos.has(String(p.id)));
}

export async function ejecutarSorteo(
  datos: { rifaId: bigint; premioId: bigint; modalidad: "externo" | "commit_reveal"; numeroGanador?: number; evidenciaUrl?: string },
  tenantId: bigint,
  actorId: bigint,
): Promise<Resultado<{ numeroGanador: number; conGanador: boolean }>> {
  const { rifaId, premioId, modalidad } = datos;
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; estado: string; numero_min: number; numero_max: number; codigo: string }[]>(
        `SELECT id, estado, numero_min, numero_max, codigo FROM saas.rifas WHERE id=$1::bigint AND tenant_id=$2::bigint FOR UPDATE`,
        rifaId, tenantId,
      );
      const rifa = filas[0];
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      if (!["activa", "cerrada", "sorteada"].includes(rifa.estado)) {
        return { ok: false as const, error: `No se puede sortear una rifa en estado '${rifa.estado}'.` };
      }
      const premio = await tx.premios.findFirst({ where: { id: premioId, rifa_id: rifaId } });
      if (!premio) return { ok: false as const, error: "Premio no encontrado en esta rifa." };
      const ya = await tx.sorteos.findFirst({ where: { rifa_id: rifaId, premio_id: premioId } });
      if (ya) return { ok: false as const, error: "Este premio ya fue sorteado." };

      let numeroGanador: number;
      let commitHash: string | null = null;
      let semilla: string | null = null;
      if (modalidad === "commit_reveal") {
        semilla = randomBytes(32).toString("hex");
        commitHash = hashSemilla(semilla);
        numeroGanador = derivarNumeroGanador(semilla, rifa.numero_min, rifa.numero_max);
      } else {
        if (datos.numeroGanador === undefined || !Number.isInteger(datos.numeroGanador) || datos.numeroGanador < rifa.numero_min || datos.numeroGanador > rifa.numero_max) {
          return { ok: false as const, error: `El número ganador debe estar entre ${rifa.numero_min} y ${rifa.numero_max}.` };
        }
        numeroGanador = datos.numeroGanador;
      }

      const sorteo = await tx.sorteos.create({
        data: { tenant_id: tenantId, rifa_id: rifaId, modalidad, numero_ganador: numeroGanador, premio_id: premioId, commit_hash: commitHash, semilla, evidencia_url: datos.evidenciaUrl || null, ejecutado_por: actorId },
      });

      const boleta = await tx.boletas.findFirst({
        where: { rifa_id: rifaId, numero: numeroGanador },
        include: { ventas: { include: { clientes: true } } },
      });
      let conGanador = false;
      if (boleta) {
        const clienteId = boleta.estado === "pagada" && boleta.ventas?.clientes ? boleta.ventas.clientes.id : null;
        conGanador = clienteId !== null;
        await tx.ganadores.create({
          data: { tenant_id: tenantId, sorteo_id: sorteo.id, rifa_id: rifaId, boleta_id: boleta.id, cliente_id: clienteId, premio_id: premioId, estado_entrega: "pendiente" },
        });
      }

      const [totalP, totalS] = await Promise.all([
        tx.premios.count({ where: { rifa_id: rifaId } }),
        tx.sorteos.count({ where: { rifa_id: rifaId } }),
      ]);
      if (totalS >= totalP && rifa.estado !== "sorteada") {
        await tx.rifas.update({ where: { id: rifaId }, data: { estado: "sorteada" } });
      }

      await auditar(tx, { tenantId, actorId, accion: "sorteo.ejecutar", entidadTipo: "sorteo", entidadId: sorteo.id, despues: { rifa: rifa.codigo, premio: premio.nombre, modalidad, numero_ganador: numeroGanador, commit_hash: commitHash, con_ganador: conGanador } });
      return { ok: true as const, data: { numeroGanador, conGanador } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al ejecutar el sorteo.") };
  }
}

export async function cambiarEntregaGanador(ganadorId: bigint, tenantId: bigint, estado: string, actorId: bigint): Promise<Resultado> {
  if (!["pendiente", "contactado", "entregado", "no_reclamado"].includes(estado)) return { ok: false, error: "Estado inválido." };
  const g = await prisma.ganadores.findFirst({ where: { id: ganadorId, tenant_id: tenantId } });
  if (!g) return { ok: false, error: "Ganador no encontrado." };
  await prisma.$transaction(async (tx) => {
    await tx.ganadores.update({ where: { id: ganadorId }, data: { estado_entrega: estado } });
    await auditar(tx, { tenantId, actorId, accion: "sorteo.ejecutar", entidadTipo: "ganador", entidadId: ganadorId, antes: { estado_entrega: g.estado_entrega }, despues: { estado_entrega: estado } });
  });
  return { ok: true };
}
