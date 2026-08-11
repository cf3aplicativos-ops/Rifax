// Servicio de vendedores y talonarios (multi-tenant). Filtra por tenant_id;
// asignación de talonarios serializada por tenant (advisory lock) para evitar
// rangos solapados. SQL crudo cualificado saas.*.
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";

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

// `sedeId` acota la lista a los vendedores de esa sede (más los que no tienen
// sede fija, que operan para todas). Se pasa cuando el usuario en sesión está
// asignado a una sede, para que no vea el personal de las demás.
export async function listarVendedores(tenantId: bigint, sedeId?: bigint | null) {
  return prisma.vendedores.findMany({
    where: { tenant_id: tenantId, ...(sedeId ? { OR: [{ sede_id: sedeId }, { sede_id: null }] } : {}) },
    orderBy: { id: "desc" },
    include: { _count: { select: { talonarios: true, ventas: true } }, sedes: { select: { nombre: true } } },
  });
}

export async function obtenerVendedor(tenantId: bigint, id: bigint, sedeId?: bigint | null) {
  return prisma.vendedores.findFirst({
    where: { id, tenant_id: tenantId, ...(sedeId ? { OR: [{ sede_id: sedeId }, { sede_id: null }] } : {}) },
    include: {
      talonarios: { orderBy: { id: "desc" }, include: { rifas: { select: { codigo: true, nombre: true } } } },
      sedes: { select: { nombre: true } },
    },
  });
}

export async function crearVendedor(input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = crearVendedorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  // La sede debe ser del mismo tenant: la FK apunta a sedes(id) sin restricción de
  // tenant, así que sin esta comprobación un sede_id de otra empresa se guardaría
  // tal cual (mismo criterio que ya aplica editarVendedor).
  if (d.sede_id) {
    const sede = await prisma.sedes.findFirst({ where: { id: d.sede_id, tenant_id: tenantId }, select: { id: true } });
    if (!sede) return { ok: false, error: "Sede inválida." };
  }
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
    return { ok: false, error: mensajeError(e, "Error al crear el vendedor.") };
  }
}

export const editarVendedorSchema = z.object({
  sede_id: z.coerce.bigint().optional(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  documento: z.string().min(3, "El documento es obligatorio."),
  telefono: z.string().min(7, "Teléfono inválido."),
  correo: z.string().email("Correo inválido.").optional(),
  pct_comision: z.coerce.number().min(0).max(100).optional(),
  cupo_max: z.coerce.number().int().positive().optional(),
});

export async function editarVendedor(vendedorId: bigint, input: unknown, tenantId: bigint, actorId: bigint): Promise<Resultado> {
  const parsed = editarVendedorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const actual = await prisma.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
  if (!actual) return { ok: false, error: "Vendedor no encontrado." };

  if (d.sede_id) {
    const sede = await prisma.sedes.findFirst({ where: { id: d.sede_id, tenant_id: tenantId } });
    if (!sede) return { ok: false, error: "Sede inválida." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vendedores.update({
        where: { id: vendedorId },
        data: {
          sede_id: d.sede_id ?? null,
          nombre: d.nombre,
          documento: d.documento,
          telefono: d.telefono,
          correo: d.correo ?? null,
          // A diferencia de sede_id/correo (donde "vacío" sí significa "sin
          // dato"), un campo de comisión o cupo vacío casi siempre es un
          // olvido al editar otro dato del vendedor, no una intención de
          // resetear a 0% o a "sin límite" — por eso, si llega vacío, se
          // conserva el valor que ya tenía en vez de borrarlo en silencio.
          pct_comision: d.pct_comision ?? actual.pct_comision,
          cupo_max: d.cupo_max ?? actual.cupo_max,
        },
      });
      await auditar(tx, {
        tenantId, actorId, accion: "vendedor.editar", entidadTipo: "vendedor", entidadId: vendedorId,
        antes: { nombre: actual.nombre, sede_id: actual.sede_id?.toString() ?? null },
        despues: { nombre: d.nombre, sede_id: d.sede_id?.toString() ?? null },
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar el vendedor.") };
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
  datos: { rifaId: bigint; vendedorId: bigint; tipo: "consecutiva" | "aleatoria" | "especificas"; inicio?: number; fin?: number; cantidad?: number; numeros?: number[] },
  tenantId: bigint,
  actorId: bigint,
): Promise<Resultado<{ boletas: number }>> {
  const { rifaId, vendedorId, tipo } = datos;
  const numerosPedidos = [...new Set(datos.numeros ?? [])].filter((n) => Number.isInteger(n) && n >= 0);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('talonarios_rifa_' || $1::text))`, String(rifaId));

      const rifa = await tx.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      const vendedor = await tx.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
      if (!vendedor) return { ok: false as const, error: "Vendedor no encontrado." };
      if (vendedor.estado !== "activo") return { ok: false as const, error: `El vendedor está '${vendedor.estado}'.` };

      // `compartida` no está en el schema de Prisma (columna agregada por SQL-first).
      const compartidaRow = await tx.$queryRawUnsafe<{ compartida: boolean }[]>(`SELECT compartida FROM saas.rifas WHERE id=$1::bigint`, rifaId);
      const rifaCompartida = compartidaRow[0]?.compartida ?? false;

      // Un vendedor con sede fija solo puede recibir boletas de esa sede; uno
      // sin sede (sede_id NULL = "todas las sedes") puede recibir de cualquiera.
      const sedeVendedor = vendedor.sede_id;
      if (sedeVendedor !== null && !rifaCompartida && rifa.sede_id !== sedeVendedor) {
        return { ok: false as const, error: "Este vendedor pertenece a otra sede; esta rifa no es de su sede." };
      }

      // Cupo del vendedor (aplica a todos los modos).
      const cantidadPedida = tipo === "consecutiva"
        ? (datos.fin ?? 0) - (datos.inicio ?? 0) + 1
        : tipo === "especificas"
          ? numerosPedidos.length
          : datos.cantidad ?? 0;
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

        // Verifica cada boleta del rango (no solo que no se solape con otro
        // talonario): puede haber boletas ya vendidas/reservadas sin talonario
        // (p. ej. vendidas directo por el punto de venta) dentro del rango.
        const boletasRango = await tx.$queryRawUnsafe<{ id: bigint; numero: number; estado: string; talonario_id: bigint | null; sede_id: bigint | null }[]>(
          `SELECT id, numero, estado, talonario_id, sede_id FROM saas.boletas
            WHERE rifa_id=$1::bigint AND numero BETWEEN $2::int AND $3::int
            ORDER BY numero FOR UPDATE`,
          rifaId, inicio, fin,
        );
        const esperadas = fin - inicio + 1;
        if (boletasRango.length !== esperadas) {
          return { ok: false as const, error: "Ese rango incluye números que no existen en la rifa." };
        }
        const ocupadas = boletasRango.filter((b) => b.estado !== "disponible" || b.talonario_id !== null).map((b) => b.numero);
        if (ocupadas.length) return { ok: false as const, error: `No disponibles o ya asignadas: ${ocupadas.join(", ")}.` };
        if (sedeVendedor !== null && rifaCompartida) {
          // Rifa compartida: cada boleta puede tener su propia sede (o ninguna aún).
          const fueraSede = boletasRango.filter((b) => (b.sede_id ?? rifa.sede_id) !== sedeVendedor).map((b) => b.numero);
          if (fueraSede.length) {
            return { ok: false as const, error: `Ese rango incluye boletas que no pertenecen a la sede del vendedor: ${fueraSede.join(", ")}.` };
          }
        }

        const talonario = await tx.talonarios.create({ data: { tenant_id: tenantId, rifa_id: rifaId, vendedor_id: vendedorId, numero_inicio: inicio, numero_fin: fin, estado: "asignado", tipo: "consecutiva" } });
        await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE id = ANY($2::bigint[])`, talonario.id, boletasRango.map((b) => b.id));
        marcadas = boletasRango.length;
        await auditar(tx, { tenantId, actorId, accion: "talonario.asignar", entidadTipo: "talonario", entidadId: talonario.id, despues: { rifa: rifa.codigo, vendedor: vendedor.nombre, tipo, rango: `${inicio}-${fin}`, boletas: marcadas } });
      } else if (tipo === "aleatoria") {
        // Aleatoria: toma N boletas disponibles y sin talonario, al azar.
        const boletas = await tx.$queryRawUnsafe<{ id: bigint; numero: number }[]>(
          `SELECT id, numero FROM saas.boletas
            WHERE rifa_id=$1::bigint AND estado='disponible' AND talonario_id IS NULL
              AND ($3::bigint IS NULL OR COALESCE(sede_id, $4::bigint) = $3::bigint)
            ORDER BY random() LIMIT $2::int
            FOR UPDATE SKIP LOCKED`,
          rifaId, cantidadPedida, sedeVendedor, rifa.sede_id,
        );
        if (boletas.length < cantidadPedida) return { ok: false as const, error: `Solo hay ${boletas.length} boletas disponibles para asignar al azar.` };
        const nums = boletas.map((b) => b.numero);
        inicio = Math.min(...nums);
        fin = Math.max(...nums);
        const talonario = await tx.talonarios.create({ data: { tenant_id: tenantId, rifa_id: rifaId, vendedor_id: vendedorId, numero_inicio: inicio, numero_fin: fin, estado: "asignado", tipo: "aleatoria" } });
        await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE id = ANY($2::bigint[])`, talonario.id, boletas.map((b) => b.id));
        marcadas = boletas.length;
        await auditar(tx, { tenantId, actorId, accion: "talonario.asignar", entidadTipo: "talonario", entidadId: talonario.id, despues: { rifa: rifa.codigo, vendedor: vendedor.nombre, tipo, cantidad: marcadas } });
      } else {
        // Específicas: los números exactos que solicitó el vendedor.
        if (numerosPedidos.length === 0) return { ok: false as const, error: "Indica los números solicitados." };
        if (numerosPedidos.some((n) => n < rifa.numero_min || n > rifa.numero_max)) {
          return { ok: false as const, error: `Los números deben estar entre ${rifa.numero_min} y ${rifa.numero_max}.` };
        }
        const boletas = await tx.$queryRawUnsafe<{ id: bigint; numero: number; estado: string; talonario_id: bigint | null; sede_id: bigint | null }[]>(
          `SELECT id, numero, estado, talonario_id, sede_id FROM saas.boletas
            WHERE rifa_id=$1::bigint AND numero = ANY($2::int[]) ORDER BY numero FOR UPDATE`,
          rifaId, numerosPedidos,
        );
        if (boletas.length !== numerosPedidos.length) {
          const enc = new Set(boletas.map((b) => b.numero));
          return { ok: false as const, error: `Números inexistentes: ${numerosPedidos.filter((n) => !enc.has(n)).join(", ")}.` };
        }
        const ocupadas = boletas.filter((b) => b.estado !== "disponible" || b.talonario_id !== null).map((b) => b.numero);
        if (ocupadas.length) return { ok: false as const, error: `No disponibles o ya asignadas: ${ocupadas.join(", ")}.` };
        if (sedeVendedor !== null) {
          const fueraSede = boletas.filter((b) => (b.sede_id ?? rifa.sede_id) !== sedeVendedor).map((b) => b.numero);
          if (fueraSede.length) return { ok: false as const, error: `No pertenecen a la sede del vendedor: ${fueraSede.join(", ")}.` };
        }
        inicio = Math.min(...numerosPedidos);
        fin = Math.max(...numerosPedidos);
        // La columna tipo solo admite consecutiva/aleatoria; una selección
        // específica no es contigua, así que se registra como 'aleatoria'.
        const talonario = await tx.talonarios.create({ data: { tenant_id: tenantId, rifa_id: rifaId, vendedor_id: vendedorId, numero_inicio: inicio, numero_fin: fin, estado: "asignado", tipo: "aleatoria" } });
        await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE id = ANY($2::bigint[])`, talonario.id, boletas.map((b) => b.id));
        marcadas = boletas.length;
        await auditar(tx, { tenantId, actorId, accion: "talonario.asignar", entidadTipo: "talonario", entidadId: talonario.id, despues: { rifa: rifa.codigo, vendedor: vendedor.nombre, tipo: "especificas", numeros: numerosPedidos.join(","), boletas: marcadas } });
      }

      return { ok: true as const, data: { boletas: marcadas } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al asignar el talonario.") };
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
    return { ok: false, error: mensajeError(e, "Error al cerrar el talonario.") };
  }
}
