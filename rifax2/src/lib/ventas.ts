// Servicio de ventas (multi-tenant). Mantiene las 3 barreras anti-doble-venta
// (FOR UPDATE, validación de estado, UNIQUE(boleta_id)), idempotencia por tenant,
// patrón outbox y aritmética monetaria exacta en Postgres. Todo cualificado saas.*
// y filtrado por tenant_id.
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
  // Canal configurable vía catálogo (tipo canal_venta); sin CHECK en BD.
  canal: z.string().min(1).default("web"),
});

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listarVentas(tenantId: bigint, sedeId: bigint | null, vendedorId?: bigint | null) {
  return prisma.ventas.findMany({
    where: { tenant_id: tenantId, ...(sedeId ? { sede_id: sedeId } : {}), ...(vendedorId ? { vendedor_id: vendedorId } : {}) },
    orderBy: { id: "desc" },
    include: { clientes: true, rifas: { select: { codigo: true } }, sedes: { select: { nombre: true } } },
    take: 100,
  });
}

export async function obtenerVenta(tenantId: bigint, id: bigint) {
  return prisma.ventas.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      clientes: true,
      rifas: { select: { codigo: true, nombre: true } },
      abonos: { orderBy: { id: "asc" } },
      ventas_boletas: { include: { boletas: true } },
    },
  });
}

export async function boletasDisponibles(tenantId: bigint, rifaId: bigint, limite = 12) {
  const filas = await prisma.boletas.findMany({
    where: { tenant_id: tenantId, rifa_id: rifaId, estado: "disponible" },
    select: { numero: true },
    orderBy: { numero: "asc" },
    take: limite,
  });
  return filas.map((f) => f.numero);
}

export async function rifasActivas(tenantId: bigint, sedeId: bigint | null) {
  return prisma.rifas.findMany({
    where: { tenant_id: tenantId, estado: "activa", ...(sedeId ? { sede_id: sedeId } : {}) },
    orderBy: { id: "desc" },
    select: { id: true, codigo: true, nombre: true, precio_boleta: true, numero_min: true, numero_max: true, sede_id: true },
  });
}

export async function crearVenta(
  input: unknown,
  tenantId: bigint,
  actorId: bigint,
  idempotencyKey?: string | null,
): Promise<Resultado<{ ventaId: bigint; codigo: string; total: string; idempotente: boolean }>> {
  const parsed = crearVentaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;
  const numeros = [...new Set(d.numeros)];

  if (idempotencyKey) {
    const previa = await prisma.ventas.findFirst({ where: { tenant_id: tenantId, idempotency_key: idempotencyKey } });
    if (previa) {
      return { ok: true, data: { ventaId: previa.id, codigo: previa.codigo, total: previa.total.toString(), idempotente: true } };
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const rifa = await tx.rifas.findFirst({ where: { id: d.rifa_id, tenant_id: tenantId } });
      if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
      if (rifa.estado !== "activa") return { ok: false as const, error: `La rifa no está activa (estado: ${rifa.estado}).` };

      const boletas = await tx.$queryRawUnsafe<{ id: bigint; numero: number; estado: string }[]>(
        `SELECT id, numero, estado FROM saas.boletas
          WHERE rifa_id = $1::bigint AND tenant_id = $2::bigint AND numero = ANY($3::int[])
          ORDER BY numero FOR UPDATE`,
        d.rifa_id,
        tenantId,
        numeros,
      );
      if (boletas.length !== numeros.length) {
        const enc = new Set(boletas.map((b) => b.numero));
        return { ok: false as const, error: `Números fuera de rango o inexistentes: ${numeros.filter((n) => !enc.has(n)).join(", ")}.` };
      }
      const ocupadas = boletas.filter((b) => b.estado !== "disponible").map((b) => b.numero);
      if (ocupadas.length) return { ok: false as const, error: `Boletas no disponibles: ${ocupadas.join(", ")}.` };

      // Cliente (upsert por tenant+teléfono)
      let cliente = await tx.clientes.findFirst({ where: { tenant_id: tenantId, telefono: d.cliente.telefono } });
      if (cliente) {
        cliente = await tx.clientes.update({
          where: { id: cliente.id },
          data: { nombre: d.cliente.nombre, ...(d.cliente.correo ? { correo: d.cliente.correo } : {}) },
        });
      } else {
        cliente = await tx.clientes.create({
          data: {
            tenant_id: tenantId,
            nombre: d.cliente.nombre,
            telefono: d.cliente.telefono,
            correo: d.cliente.correo ?? null,
            documento: d.cliente.documento ?? null,
            consentimiento_datos: d.cliente.consentimiento_datos ?? false,
          },
        });
      }

      const precio = rifa.precio_boleta;
      const total = precio.mul(numeros.length);
      const creada = await tx.ventas.create({
        data: {
          tenant_id: tenantId,
          sede_id: rifa.sede_id,
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

      await tx.ventas_boletas.createMany({ data: boletas.map((b) => ({ venta_id: creada.id, boleta_id: b.id, precio })) });
      await tx.$executeRawUnsafe(
        `UPDATE saas.boletas SET estado='reservada', venta_id=$1::bigint, version=version+1, actualizado_en=now()
          WHERE rifa_id=$2::bigint AND numero = ANY($3::int[])`,
        creada.id,
        d.rifa_id,
        numeros,
      );
      await tx.outbox_notificaciones.create({
        data: { tenant_id: tenantId, evento: "venta.creada", payload: { venta_id: String(creada.id), codigo }, canal: "whatsapp" },
      });
      await auditar(tx, {
        tenantId,
        actorId,
        accion: "venta.crear",
        entidadTipo: "venta",
        entidadId: creada.id,
        despues: { codigo, cantidad: numeros.length, total: total.toString() },
      });

      return { ok: true as const, data: { ventaId: creada.id, codigo, total: total.toString(), idempotente: false } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la venta." };
  }
}

export async function registrarAbono(
  tenantId: bigint,
  ventaId: bigint,
  datos: { monto: number | string; origen?: "pasarela" | "comprobante" | "efectivo" | "ajuste" },
  actorId: bigint,
): Promise<Resultado<{ saldo: string; estado: string }>> {
  if (!(Number(datos.monto) > 0)) return { ok: false, error: "El monto debe ser positivo." };
  const montoTexto = String(datos.monto);

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; saldo: string; estado: string }[]>(
        `SELECT id, saldo::text AS saldo, estado FROM saas.ventas WHERE id=$1::bigint AND tenant_id=$2::bigint FOR UPDATE`,
        ventaId,
        tenantId,
      );
      const venta = filas[0];
      if (!venta) return { ok: false as const, error: "Venta no encontrada." };
      if (venta.estado === "anulada" || venta.estado === "pagada") {
        return { ok: false as const, error: `La venta está '${venta.estado}'.` };
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO saas.abonos (tenant_id, venta_id, origen, monto, registrado_por)
         VALUES ($1::bigint,$2::bigint,$3::text,$4::numeric,$5::bigint)`,
        tenantId,
        ventaId,
        datos.origen ?? "efectivo",
        montoTexto,
        actorId,
      );
      const upd = await tx.$queryRawUnsafe<{ saldo: string; estado: string }[]>(
        `UPDATE saas.ventas
            SET saldo  = GREATEST(saldo - $2::numeric, 0),
                estado = CASE WHEN saldo - $2::numeric <= 0 THEN 'pagada' ELSE 'parcial' END
          WHERE id = $1::bigint
        RETURNING saldo::text AS saldo, estado`,
        ventaId,
        montoTexto,
      );
      const nuevoSaldo = upd[0].saldo;
      const nuevoEstado = upd[0].estado;

      if (nuevoEstado === "pagada") {
        await tx.$executeRawUnsafe(
          `UPDATE saas.boletas SET estado='pagada', actualizado_en=now() WHERE venta_id=$1::bigint`,
          ventaId,
        );
        await tx.outbox_notificaciones.create({
          data: { tenant_id: tenantId, evento: "venta.pagada", payload: { venta_id: String(ventaId) }, canal: "whatsapp" },
        });
      }

      await auditar(tx, {
        tenantId,
        actorId,
        accion: "pago.abono",
        entidadTipo: "venta",
        entidadId: ventaId,
        antes: { saldo: venta.saldo, estado: venta.estado },
        despues: { saldo: nuevoSaldo, estado: nuevoEstado },
      });
      return { ok: true as const, data: { saldo: nuevoSaldo, estado: nuevoEstado } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar el abono." };
  }
}

// Recalcula saldo/estado de una venta a partir de sus abonos y ajusta el estado
// de sus boletas (pagada ↔ reservada). No toca ventas anuladas.
async function recalcularVenta(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], ventaId: bigint): Promise<string> {
  const filas = await tx.$queryRawUnsafe<{ estado: string }[]>(
    `UPDATE saas.ventas v SET
        saldo = GREATEST(v.total - COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0), 0),
        estado = CASE
                   WHEN v.estado = 'anulada' THEN 'anulada'
                   WHEN v.total - COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0) <= 0 THEN 'pagada'
                   WHEN COALESCE((SELECT SUM(a.monto) FROM saas.abonos a WHERE a.venta_id = v.id), 0) > 0 THEN 'parcial'
                   ELSE 'pendiente_pago'
                 END
      WHERE v.id = $1::bigint
      RETURNING estado`,
    ventaId,
  );
  const estado = filas[0]?.estado ?? "pendiente_pago";
  if (estado === "pagada") {
    await tx.$executeRawUnsafe(`UPDATE saas.boletas SET estado='pagada', actualizado_en=now() WHERE venta_id=$1::bigint AND estado<>'pagada'`, ventaId);
  } else if (estado === "parcial" || estado === "pendiente_pago") {
    // Si dejó de estar pagada, las boletas vuelven a 'reservada' (siguen ligadas a la venta).
    await tx.$executeRawUnsafe(`UPDATE saas.boletas SET estado='reservada', actualizado_en=now() WHERE venta_id=$1::bigint AND estado='pagada'`, ventaId);
  }
  return estado;
}

export async function editarAbono(
  tenantId: bigint,
  abonoId: bigint,
  datos: { monto: number | string; origen?: string },
  actorId: bigint,
): Promise<Resultado<{ estado: string }>> {
  if (!(Number(datos.monto) > 0)) return { ok: false, error: "El monto debe ser positivo." };
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; venta_id: bigint; venta_estado: string }[]>(
        `SELECT a.id, a.venta_id, v.estado AS venta_estado
           FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
          WHERE a.id = $1::bigint AND a.tenant_id = $2::bigint FOR UPDATE`,
        abonoId, tenantId,
      );
      const a = filas[0];
      if (!a) return { ok: false as const, error: "Abono no encontrado." };
      if (a.venta_estado === "anulada") return { ok: false as const, error: "La venta está anulada." };
      const origenOk = ["pasarela", "comprobante", "efectivo", "ajuste"].includes(String(datos.origen)) ? String(datos.origen) : "efectivo";
      await tx.$executeRawUnsafe(`UPDATE saas.abonos SET monto=$2::numeric, origen=$3::text WHERE id=$1::bigint`, abonoId, String(datos.monto), origenOk);
      const estado = await recalcularVenta(tx, a.venta_id);
      await auditar(tx, { tenantId, actorId, accion: "pago.abono", entidadTipo: "abono", entidadId: abonoId, despues: { editado: true, monto: String(datos.monto), origen: origenOk } });
      return { ok: true as const, data: { estado } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al editar el abono." };
  }
}

export async function eliminarAbono(tenantId: bigint, abonoId: bigint, actorId: bigint): Promise<Resultado<{ estado: string }>> {
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; venta_id: bigint; venta_estado: string }[]>(
        `SELECT a.id, a.venta_id, v.estado AS venta_estado
           FROM saas.abonos a JOIN saas.ventas v ON v.id = a.venta_id
          WHERE a.id = $1::bigint AND a.tenant_id = $2::bigint FOR UPDATE`,
        abonoId, tenantId,
      );
      const a = filas[0];
      if (!a) return { ok: false as const, error: "Abono no encontrado." };
      if (a.venta_estado === "anulada") return { ok: false as const, error: "La venta está anulada." };
      await tx.$executeRawUnsafe(`DELETE FROM saas.abonos WHERE id=$1::bigint`, abonoId);
      const estado = await recalcularVenta(tx, a.venta_id);
      await auditar(tx, { tenantId, actorId, accion: "pago.abono", entidadTipo: "abono", entidadId: abonoId, despues: { eliminado: true } });
      return { ok: true as const, data: { estado } };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar el abono." };
  }
}

export async function anularVenta(
  tenantId: bigint,
  ventaId: bigint,
  motivo: string,
  actorId: bigint,
): Promise<Resultado<{ estado: string }>> {
  if (!motivo?.trim()) return { ok: false, error: "El motivo de anulación es obligatorio." };
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; estado: string }[]>(
        `SELECT id, estado FROM saas.ventas WHERE id=$1::bigint AND tenant_id=$2::bigint FOR UPDATE`,
        ventaId,
        tenantId,
      );
      const venta = filas[0];
      if (!venta) return { ok: false as const, error: "Venta no encontrada." };
      if (venta.estado === "anulada") return { ok: false as const, error: "La venta ya está anulada." };

      await tx.$executeRawUnsafe(
        `UPDATE saas.boletas SET estado='disponible', venta_id=NULL, version=version+1, actualizado_en=now() WHERE venta_id=$1::bigint`,
        ventaId,
      );
      await tx.ventas_boletas.deleteMany({ where: { venta_id: ventaId } });
      await tx.ventas.update({ where: { id: ventaId }, data: { estado: "anulada" } });
      await auditar(tx, {
        tenantId,
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
