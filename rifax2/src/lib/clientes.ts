// Gestión de clientes (editar datos y anular/reactivar).
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";

type Resultado = { ok: true } | { ok: false; error: string };

export async function actualizarCliente(
  tenantId: bigint,
  clienteId: bigint,
  datos: { nombre: string; telefono: string; correo?: string | null; documento?: string | null },
  actorId: bigint,
): Promise<Resultado> {
  if (!datos.nombre?.trim() || datos.nombre.trim().length < 2) return { ok: false, error: "Nombre inválido." };
  if (!datos.telefono?.trim() || datos.telefono.trim().length < 7) return { ok: false, error: "Teléfono inválido." };
  const cliente = await prisma.clientes.findFirst({ where: { id: clienteId, tenant_id: tenantId } });
  if (!cliente) return { ok: false, error: "Cliente no encontrado." };
  // El teléfono es único por tenant.
  const dup = await prisma.clientes.findFirst({ where: { tenant_id: tenantId, telefono: datos.telefono.trim(), id: { not: clienteId } } });
  if (dup) return { ok: false, error: "Otro cliente ya usa ese teléfono." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.clientes.update({
        where: { id: clienteId },
        data: {
          nombre: datos.nombre.trim(),
          telefono: datos.telefono.trim(),
          correo: datos.correo?.trim() || null,
          documento: datos.documento?.trim() || null,
        },
      });
      await auditar(tx, { tenantId, actorId, accion: "cliente.editar", entidadTipo: "cliente", entidadId: clienteId, despues: { nombre: datos.nombre.trim(), telefono: datos.telefono.trim() } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al actualizar el cliente.") };
  }
}

export async function cambiarEstadoCliente(tenantId: bigint, clienteId: bigint, estado: string, actorId: bigint): Promise<Resultado> {
  if (!["activo", "inactivo"].includes(estado)) return { ok: false, error: "Estado inválido." };
  const cliente = await prisma.clientes.findFirst({ where: { id: clienteId, tenant_id: tenantId }, select: { id: true } });
  if (!cliente) return { ok: false, error: "Cliente no encontrado." };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE saas.clientes SET estado=$1::text WHERE id=$2::bigint`, estado, clienteId);
    await auditar(tx, { tenantId, actorId, accion: "cliente.editar", entidadTipo: "cliente", entidadId: clienteId, despues: { estado } });
  });
  return { ok: true };
}

export async function estadoCliente(tenantId: bigint, clienteId: bigint): Promise<string> {
  const filas = await prisma.$queryRawUnsafe<{ estado: string }[]>(`SELECT estado FROM saas.clientes WHERE id=$1::bigint AND tenant_id=$2::bigint`, clienteId, tenantId);
  return filas[0]?.estado ?? "activo";
}

export interface ClienteAutocompletado {
  nombre: string;
  telefono: string;
  correo: string | null;
  documento: string;
  ultimaSede: string | null;
  ultimoVendedor: string | null;
}

// Base de datos de clientes para autocompletar en "Nueva venta" (punto 15):
// busca por número de documento en TODAS las sedes del tenant (a propósito —
// un cliente puede haber comprado antes en otra sede) e informa dónde y con
// quién fue su última compra, para que quien vende ahora lo sepa de un
// vistazo. Solo clientes activos; si hay más de uno con el mismo documento
// (dato libre, no único), se toma el más reciente.
export async function buscarClientePorDocumento(tenantId: bigint, documentoCrudo: string): Promise<ClienteAutocompletado | null> {
  const documento = documentoCrudo.trim();
  if (!documento) return null;
  const filas = await prisma.$queryRawUnsafe<
    { nombre: string; telefono: string; correo: string | null; documento: string; ultima_sede: string | null; ultimo_vendedor: string | null }[]
  >(
    `SELECT c.nombre, c.telefono, c.correo, c.documento,
            uv.sede_nombre AS ultima_sede, uv.vendedor_nombre AS ultimo_vendedor
       FROM saas.clientes c
       LEFT JOIN LATERAL (
         SELECT s.nombre AS sede_nombre, ve.nombre AS vendedor_nombre
           FROM saas.ventas v
           JOIN saas.sedes s ON s.id = v.sede_id
           LEFT JOIN saas.vendedores ve ON ve.id = v.vendedor_id
          WHERE v.cliente_id = c.id AND v.tenant_id = c.tenant_id
          ORDER BY v.creado_en DESC
          LIMIT 1
       ) uv ON true
      WHERE c.tenant_id = $1::bigint AND c.documento = $2::text AND c.estado = 'activo'
      ORDER BY c.creado_en DESC
      LIMIT 1`,
    tenantId, documento,
  );
  const f = filas[0];
  if (!f) return null;
  return {
    nombre: f.nombre, telefono: f.telefono, correo: f.correo, documento: f.documento,
    ultimaSede: f.ultima_sede, ultimoVendedor: f.ultimo_vendedor,
  };
}
