// Portal del vendedor: vincula el usuario de login (rol vendedor) con su
// registro en `vendedores` (vendedores.usuario_id) y expone sus talonarios y
// ventas. El admin crea el acceso desde el detalle del vendedor.
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";

type Resultado = { ok: true } | { ok: false; error: string };

export async function getPortalVendedor(tenantId: bigint, usuarioId: bigint) {
  const vendedor = await prisma.vendedores.findFirst({
    where: { tenant_id: tenantId, usuario_id: usuarioId },
    include: {
      talonarios: {
        orderBy: { id: "desc" },
        include: { rifas: { select: { codigo: true, nombre: true, estado: true } } },
      },
    },
  });
  if (!vendedor) return null;

  const ventas = await prisma.ventas.findMany({
    where: { tenant_id: tenantId, vendedor_id: vendedor.id },
    orderBy: { id: "desc" },
    take: 15,
    include: { clientes: { select: { nombre: true } }, rifas: { select: { codigo: true } } },
  });
  return { vendedor, ventas };
}

export async function crearAccesoVendedor(
  vendedorId: bigint,
  tenantId: bigint,
  correo: string,
  password: string,
  actorId: bigint,
): Promise<Resultado> {
  const c = correo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { ok: false, error: "Correo inválido." };
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  const vendedor = await prisma.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
  if (!vendedor) return { ok: false, error: "Vendedor no encontrado." };
  if (vendedor.usuario_id) return { ok: false, error: "Este vendedor ya tiene un acceso." };

  const rol = await prisma.roles.findUnique({ where: { nombre: "vendedor" } });
  if (!rol) return { ok: false, error: "No existe el rol 'vendedor'." };
  const dup = await prisma.usuarios.findFirst({ where: { tenant_id: tenantId, correo: c } });
  if (dup) return { ok: false, error: "Ya existe un usuario con ese correo." };

  try {
    const hash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const u = await tx.usuarios.create({
        data: { tenant_id: tenantId, sede_id: vendedor.sede_id, nombre: vendedor.nombre, correo: c, password_hash: hash, rol_id: rol.id, estado: "activo" },
      });
      await tx.vendedores.update({ where: { id: vendedorId }, data: { usuario_id: u.id } });
      await auditar(tx, { tenantId, actorId, accion: "usuario.crear", entidadTipo: "vendedor", entidadId: vendedorId, despues: { acceso: c, rol: "vendedor" } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el acceso." };
  }
}
