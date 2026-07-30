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

// Rifas activas en las que el vendedor tiene talonarios abiertos, con las
// boletas DISPONIBLES dentro de sus rangos asignados (para el desplegable de
// selección en la app del vendedor).
export interface RifaVentaVendedor {
  id: string;
  codigo: string;
  nombre: string;
  precio: string;
  numeroMin: number;
  numeroMax: number;
  disponibles: number[];
}

export async function rifasVentaVendedor(tenantId: bigint, vendedorId: bigint): Promise<RifaVentaVendedor[]> {
  const tals = await prisma.talonarios.findMany({
    where: { tenant_id: tenantId, vendedor_id: vendedorId, estado: { not: "cerrado" }, rifas: { estado: "activa" } },
    include: { rifas: { select: { id: true, codigo: true, nombre: true, precio_boleta: true, numero_min: true, numero_max: true } } },
    orderBy: { id: "desc" },
  });

  // Agrupa los rangos por rifa.
  const porRifa = new Map<string, { rifa: (typeof tals)[number]["rifas"]; rangos: { inicio: number; fin: number }[] }>();
  for (const t of tals) {
    const k = String(t.rifa_id);
    if (!porRifa.has(k)) porRifa.set(k, { rifa: t.rifas, rangos: [] });
    porRifa.get(k)!.rangos.push({ inicio: t.numero_inicio, fin: t.numero_fin });
  }

  const salida: RifaVentaVendedor[] = [];
  for (const { rifa, rangos } of porRifa.values()) {
    const filas = await prisma.boletas.findMany({
      where: {
        tenant_id: tenantId,
        rifa_id: rifa.id,
        estado: "disponible",
        OR: rangos.map((r) => ({ numero: { gte: r.inicio, lte: r.fin } })),
      },
      select: { numero: true },
      orderBy: { numero: "asc" },
      take: 2000,
    });
    salida.push({
      id: String(rifa.id),
      codigo: rifa.codigo,
      nombre: rifa.nombre,
      precio: rifa.precio_boleta.toString(),
      numeroMin: rifa.numero_min,
      numeroMax: rifa.numero_max,
      disponibles: filas.map((f) => f.numero),
    });
  }
  return salida;
}

// Verifica que TODOS los números estén dentro de los talonarios (no cerrados)
// del vendedor para esa rifa. Blindaje de servidor (no confía en el cliente).
export async function numerosPermitidosVendedor(
  tenantId: bigint,
  vendedorId: bigint,
  rifaId: bigint,
  numeros: number[],
): Promise<boolean> {
  if (numeros.length === 0) return false;
  const rangos = await prisma.talonarios.findMany({
    where: { tenant_id: tenantId, vendedor_id: vendedorId, rifa_id: rifaId, estado: { not: "cerrado" } },
    select: { numero_inicio: true, numero_fin: true },
  });
  if (rangos.length === 0) return false;
  return numeros.every((n) => rangos.some((r) => n >= r.numero_inicio && n <= r.numero_fin));
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
