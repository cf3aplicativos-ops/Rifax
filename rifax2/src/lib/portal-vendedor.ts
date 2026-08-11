// Portal del vendedor: vincula el usuario de login (rol vendedor) con su
// registro en `vendedores` (vendedores.usuario_id) y expone sus talonarios y
// ventas. El admin crea el acceso desde el detalle del vendedor.
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { mensajeError } from "@/lib/errores";
import { sendMail, mailPasswordCambiada } from "@/lib/mail";
import { imagenesRifa } from "@/lib/rifas";

type Resultado = { ok: true } | { ok: false; error: string };

// Devuelve el id de vendedor vinculado a un usuario (o null). Se usa para
// acotar las páginas del panel cuando quien entra es un vendedor.
export async function vendedorIdDeUsuario(tenantId: bigint, usuarioId: bigint): Promise<bigint | null> {
  const v = await prisma.vendedores.findFirst({ where: { tenant_id: tenantId, usuario_id: usuarioId }, select: { id: true } });
  return v?.id ?? null;
}

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
  boletaImagenUrl: string | null;
}

export async function rifasVentaVendedor(tenantId: bigint, vendedorId: bigint): Promise<RifaVentaVendedor[]> {
  const tals = await prisma.talonarios.findMany({
    where: { tenant_id: tenantId, vendedor_id: vendedorId, estado: { not: "cerrado" }, rifas: { estado: "activa" } },
    include: { rifas: { select: { id: true, codigo: true, nombre: true, precio_boleta: true, numero_min: true, numero_max: true } } },
    orderBy: { id: "desc" },
  });

  // Agrupa los talonarios por rifa.
  const porRifa = new Map<string, { rifa: (typeof tals)[number]["rifas"]; talonarios: bigint[] }>();
  for (const t of tals) {
    const k = String(t.rifa_id);
    if (!porRifa.has(k)) porRifa.set(k, { rifa: t.rifas, talonarios: [] });
    porRifa.get(k)!.talonarios.push(t.id);
  }

  const salida: RifaVentaVendedor[] = [];
  for (const { rifa, talonarios } of porRifa.values()) {
    // Boletas realmente asignadas a los talonarios del vendedor y disponibles.
    const filas = await prisma.boletas.findMany({
      where: { tenant_id: tenantId, rifa_id: rifa.id, estado: "disponible", talonario_id: { in: talonarios } },
      select: { numero: true },
      orderBy: { numero: "asc" },
      take: 5000,
    });
    salida.push({
      id: String(rifa.id),
      codigo: rifa.codigo,
      nombre: rifa.nombre,
      precio: rifa.precio_boleta.toString(),
      numeroMin: rifa.numero_min,
      numeroMax: rifa.numero_max,
      disponibles: filas.map((f) => f.numero),
      boletaImagenUrl: (await imagenesRifa(tenantId, rifa.id)).boleta,
    });
  }
  return salida;
}

// Verifica que TODOS los números correspondan a boletas asignadas a los
// talonarios (no cerrados) del vendedor. Blindaje de servidor.
export async function numerosPermitidosVendedor(
  tenantId: bigint,
  vendedorId: bigint,
  rifaId: bigint,
  numeros: number[],
): Promise<boolean> {
  if (numeros.length === 0) return false;
  const tals = await prisma.talonarios.findMany({
    where: { tenant_id: tenantId, vendedor_id: vendedorId, rifa_id: rifaId, estado: { not: "cerrado" } },
    select: { id: true },
  });
  if (tals.length === 0) return false;
  const asignadas = await prisma.boletas.findMany({
    where: { tenant_id: tenantId, rifa_id: rifaId, talonario_id: { in: tals.map((t) => t.id) }, numero: { in: numeros } },
    select: { numero: true },
  });
  const set = new Set(asignadas.map((b) => b.numero));
  return numeros.every((n) => set.has(n));
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
      // Obliga a definir contraseña propia en el primer ingreso.
      await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, u.id);
      await tx.vendedores.update({ where: { id: vendedorId }, data: { usuario_id: u.id } });
      await auditar(tx, { tenantId, actorId, accion: "usuario.crear", entidadTipo: "vendedor", entidadId: vendedorId, despues: { acceso: c, rol: "vendedor" } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al crear el acceso.") };
  }
}

// Cambia el correo y/o la contraseña del acceso al portal de un vendedor que
// ya lo tiene. `password` es opcional: si no se indica, se conserva la
// actual (no puede mostrarse ni recuperarse, solo reemplazarse).
export async function actualizarAccesoVendedor(
  vendedorId: bigint,
  tenantId: bigint,
  correo: string,
  password: string | undefined,
  actorId: bigint,
): Promise<Resultado> {
  const c = correo.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return { ok: false, error: "Correo inválido." };
  if (password && password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  const vendedor = await prisma.vendedores.findFirst({ where: { id: vendedorId, tenant_id: tenantId } });
  if (!vendedor) return { ok: false, error: "Vendedor no encontrado." };
  if (!vendedor.usuario_id) return { ok: false, error: "Este vendedor todavía no tiene acceso al portal." };

  const usuario = await prisma.usuarios.findUnique({ where: { id: vendedor.usuario_id } });
  if (!usuario) return { ok: false, error: "Acceso no encontrado." };

  if (c !== usuario.correo) {
    const dup = await prisma.usuarios.findFirst({ where: { tenant_id: tenantId, correo: c, NOT: { id: usuario.id } } });
    if (dup) return { ok: false, error: "Ya existe otro usuario con ese correo." };
  }

  try {
    const hash = password ? await hashPassword(password) : null;
    await prisma.$transaction(async (tx) => {
      await tx.usuarios.update({ where: { id: usuario.id }, data: { correo: c, ...(hash ? { password_hash: hash } : {}) } });
      if (hash) {
        // Contraseña fijada por el admin: obliga a confirmarla en el
        // próximo ingreso y cierra las sesiones activas del vendedor.
        await tx.$executeRawUnsafe(`UPDATE saas.usuarios SET debe_cambiar_password = true WHERE id = $1::bigint`, usuario.id);
        await tx.sesiones.updateMany({ where: { usuario_id: usuario.id, revocada: false }, data: { revocada: true } });
      }
      await auditar(tx, { tenantId, actorId, accion: "usuario.editar", entidadTipo: "vendedor", entidadId: vendedorId, despues: { acceso: c, password_cambiada: Boolean(hash) } });
    });
    if (hash) {
      // Igual que en el "olvidé mi contraseña" self-service: la clave se
      // envía al correo de la cuenta, nunca se muestra en pantalla. Un fallo
      // de SMTP no debe revertir el cambio ya guardado, solo queda sin avisar.
      try {
        await sendMail({ to: c, ...mailPasswordCambiada({ nombre: usuario.nombre, password: password! }) });
      } catch (e) {
        console.error("[portal-vendedor] fallo al enviar el correo de contraseña actualizada:", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al actualizar el acceso.") };
  }
}
