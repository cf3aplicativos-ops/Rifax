// Servicio de ventas (multi-tenant). Mantiene las 3 barreras anti-doble-venta
// (FOR UPDATE, validación de estado, UNIQUE(boleta_id)), idempotencia por tenant,
// patrón outbox y aritmética monetaria exacta en Postgres. Todo cualificado saas.*
// y filtrado por tenant_id.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";
import { vendedorIdDeUsuario } from "@/lib/portal-vendedor";
import type { TenantUser } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Alcance por objeto (autorización a nivel de registro, no solo de tenant).
// Las listas ya se acotan por sede/vendedor; estas guardas replican ese mismo
// criterio en el detalle y en las acciones que reciben un id por formulario,
// para que nadie llegue a una venta ajena escribiendo su id en la URL.
// ---------------------------------------------------------------------------

/** ¿La venta cae dentro del alcance del usuario en sesión? */
export async function ventaEnAlcance(user: TenantUser, ventaId: bigint): Promise<boolean> {
  const v = await prisma.ventas.findFirst({
    where: { id: ventaId, tenant_id: user.tenant.id },
    select: { sede_id: true, vendedor_id: true },
  });
  if (!v) return false;
  // Usuario acotado a una sede: solo las ventas de esa sede.
  if (user.sede && v.sede_id !== user.sede.id) return false;
  // Vendedor: solo las ventas atribuidas a él.
  if (user.rol === "vendedor") {
    const vendedorId = await vendedorIdDeUsuario(user.tenant.id, user.id);
    if (!vendedorId || v.vendedor_id !== vendedorId) return false;
  }
  return true;
}

// Registro de un abono de una venta de OTRA sede (punto 14): restringido a
// roles de oficina (nunca vendedor, aunque tuviera el permiso por un
// override) con el permiso explícito `pago.registrar_otra_sede`. A
// diferencia de `ventaEnAlcance`, aquí NO se exige coincidencia de sede — es
// justamente la excepción pedida — pero se sigue exigiendo que la venta sea
// del mismo tenant.
export async function ventaEnAlcanceOtraSede(user: TenantUser, ventaId: bigint): Promise<boolean> {
  if (user.rol === "vendedor" || !user.permisos.includes("pago.registrar_otra_sede")) return false;
  const v = await prisma.ventas.findFirst({ where: { id: ventaId, tenant_id: user.tenant.id }, select: { id: true } });
  return !!v;
}

/** Igual que `ventaEnAlcance`, pero también admite el cruce de sede autorizado (recibo). */
export async function ventaEnAlcanceParaRecibo(user: TenantUser, ventaId: bigint): Promise<boolean> {
  return (await ventaEnAlcance(user, ventaId)) || (await ventaEnAlcanceOtraSede(user, ventaId));
}

export interface VentaBusquedaAbono {
  ventaId: string; codigo: string; cliente: string; documento: string | null; telefono: string;
  rifa: string; sede: string; total: string; saldo: string; estado: string;
}

// Búsqueda para el abono de otra sede (oficina): por código de venta, número
// de boleta o documento del cliente — SIN filtrar por sede (a propósito, es
// la excepción del punto 14). Se acota al tenant y devuelve lo mínimo
// necesario para confirmar que es la venta correcta antes de cobrar.
export async function buscarVentasParaAbono(tenantId: bigint, criterioCrudo: string): Promise<VentaBusquedaAbono[]> {
  const criterio = criterioCrudo.trim();
  if (!criterio) return [];
  const numero = /^\d+$/.test(criterio) ? Number(criterio) : null;

  const filas = await prisma.$queryRawUnsafe<
    { venta_id: bigint; codigo: string; cliente: string; documento: string | null; telefono: string; rifa: string; sede: string; total: string; saldo: string; estado: string }[]
  >(
    `SELECT v.id AS venta_id, v.codigo, cl.nombre AS cliente, cl.documento, cl.telefono,
            r.nombre AS rifa, s.nombre AS sede, v.total::text, v.saldo::text, v.estado
       FROM saas.ventas v
       JOIN saas.clientes cl ON cl.id = v.cliente_id
       JOIN saas.rifas r ON r.id = v.rifa_id
       JOIN saas.sedes s ON s.id = v.sede_id
      WHERE v.tenant_id = $1::bigint
        AND v.estado <> 'anulada'
        AND (
          v.codigo ILIKE $2
          OR cl.documento = $3
          OR ($4::int IS NOT NULL AND EXISTS (
            SELECT 1 FROM saas.ventas_boletas vb JOIN saas.boletas b ON b.id = vb.boleta_id
             WHERE vb.venta_id = v.id AND b.numero = $4::int
          ))
        )
      ORDER BY v.creado_en DESC
      LIMIT 20`,
    tenantId, `%${criterio}%`, criterio, numero,
  );
  return filas.map((f) => ({
    ventaId: String(f.venta_id), codigo: f.codigo, cliente: f.cliente, documento: f.documento, telefono: f.telefono,
    rifa: f.rifa, sede: f.sede, total: f.total, saldo: f.saldo, estado: f.estado,
  }));
}

/** ¿El abono pertenece a una venta dentro del alcance del usuario? */
export async function abonoEnAlcance(user: TenantUser, abonoId: bigint): Promise<boolean> {
  const a = await prisma.abonos.findFirst({
    where: { id: abonoId, tenant_id: user.tenant.id },
    select: { venta_id: true },
  });
  if (!a) return false;
  return ventaEnAlcance(user, a.venta_id);
}

/** ¿El cliente tiene al menos una venta dentro del alcance del usuario? */
export async function clienteEnAlcance(user: TenantUser, clienteId: bigint): Promise<boolean> {
  const vendedorId = user.rol === "vendedor" ? await vendedorIdDeUsuario(user.tenant.id, user.id) : null;
  if (user.rol === "vendedor" && !vendedorId) return false;
  if (!user.sede && !vendedorId) {
    // Sin restricción de sede ni de vendedor: basta con que sea de su empresa.
    const c = await prisma.clientes.findFirst({ where: { id: clienteId, tenant_id: user.tenant.id }, select: { id: true } });
    return !!c;
  }
  const v = await prisma.ventas.findFirst({
    where: {
      tenant_id: user.tenant.id,
      cliente_id: clienteId,
      ...(user.sede ? { sede_id: user.sede.id } : {}),
      ...(vendedorId ? { vendedor_id: vendedorId } : {}),
    },
    select: { id: true },
  });
  return !!v;
}

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
  const ventas = await prisma.ventas.findMany({
    where: { tenant_id: tenantId, ...(sedeId ? { sede_id: sedeId } : {}), ...(vendedorId ? { vendedor_id: vendedorId } : {}) },
    orderBy: { id: "desc" },
    include: {
      clientes: true, rifas: { select: { codigo: true } }, sedes: { select: { nombre: true } }, vendedores: { select: { nombre: true } },
      ventas_boletas: { include: { boletas: { select: { id: true, numero: true } } } },
    },
    take: 100,
  });

  // Observaciones de traspaso: si alguna boleta de la venta llegó a manos de
  // quien la vendió por un traspaso APROBADO, se anota de quién a quién
  // (mismo criterio que el mensaje "Fue un traspaso al vendedor..." de
  // buscarBoleta en traspasos.ts, pero aquí también con el nombre de quien
  // la tenía antes). Una sola consulta batched para todas las boletas
  // visibles, en vez de una por venta.
  const boletaIds = ventas.flatMap((v) => v.ventas_boletas.map((vb) => vb.boletas.id));
  const traspasos = boletaIds.length
    ? await prisma.$queryRawUnsafe<{ boleta_id: bigint; numero: number; propietario_nombre: string | null; solicitante_nombre: string | null; solicitante_tipo: string }[]>(
        `SELECT DISTINCT ON (sb.boleta_id) sb.boleta_id, sb.numero,
                COALESCE(vp.nombre, sp.nombre) AS propietario_nombre,
                COALESCE(vs.nombre, ss.nombre) AS solicitante_nombre,
                sb.solicitante_tipo
           FROM saas.solicitudes_boleta sb
           LEFT JOIN saas.vendedores vp ON vp.id = sb.propietario_vendedor_id
           LEFT JOIN saas.sedes sp ON sp.id = sb.propietario_sede_id
           LEFT JOIN saas.vendedores vs ON vs.id = sb.solicitante_vendedor_id
           LEFT JOIN saas.sedes ss ON ss.id = sb.solicitante_sede_id
          WHERE sb.boleta_id = ANY($1::bigint[]) AND sb.estado = 'aprobada'
          ORDER BY sb.boleta_id, sb.resuelto_en DESC`,
        boletaIds,
      )
    : [];
  const traspasoPorBoleta = new Map(traspasos.map((t) => [String(t.boleta_id), t]));

  return ventas.map((v) => {
    const boletas = v.ventas_boletas.map((vb) => vb.boletas.numero).sort((a, b) => a - b);
    const notas = v.ventas_boletas
      .map((vb) => traspasoPorBoleta.get(String(vb.boletas.id)))
      .filter((t): t is NonNullable<typeof t> => t !== undefined && t.solicitante_tipo === "vendedor")
      .map((t) => `Boleta #${t.numero}: traspasada de ${t.propietario_nombre ?? "—"} a ${t.solicitante_nombre ?? "—"}.`);
    return { ...v, boletas, observaciones: notas.length ? notas.join(" ") : null };
  });
}

export async function obtenerVenta(tenantId: bigint, id: bigint) {
  return prisma.ventas.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      clientes: true,
      sedes: { select: { nombre: true } },
      vendedores: { select: { nombre: true } },
      rifas: { select: { codigo: true, nombre: true } },
      abonos: { orderBy: { id: "asc" } },
      ventas_boletas: { include: { boletas: true } },
    },
  });
}

// Boletas del punto de venta (informativo, sede/oficina): disponibles y SIN
// talonario asignado a un vendedor — en cuanto se le asigna un talonario
// (aunque siga en estado 'disponible') pasa a ser inventario del vendedor,
// no del punto de venta, y debe desaparecer de esta lista.
export async function boletasDisponibles(tenantId: bigint, rifaId: bigint, limite = 12, sedeId?: bigint | null) {
  const filas = await prisma.$queryRawUnsafe<{ numero: number }[]>(
    `SELECT numero FROM saas.boletas
      WHERE tenant_id = $1::bigint AND rifa_id = $2::bigint AND estado = 'disponible' AND talonario_id IS NULL
        AND ($4::bigint IS NULL OR sede_id = $4::bigint)
      ORDER BY numero ASC LIMIT $3::int`,
    tenantId, rifaId, limite, sedeId ?? null,
  );
  return filas.map((f) => f.numero);
}

// Rifas activas para vender: las de la sede del usuario + las compartidas (para todas las sedes).
export async function rifasActivas(tenantId: bigint, sedeId: bigint | null) {
  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; codigo: string; nombre: string; precio_boleta: string; numero_min: number; numero_max: number; sede_id: bigint; compartida: boolean }[]
  >(
    `SELECT id, codigo, nombre, precio_boleta::text AS precio_boleta, numero_min, numero_max, sede_id, compartida
       FROM saas.rifas
      WHERE tenant_id = $1::bigint AND estado = 'activa'
        AND ($2::bigint IS NULL OR sede_id = $2::bigint OR compartida = true)
      ORDER BY id DESC`,
    tenantId, sedeId,
  );
  return filas;
}

export async function crearVenta(
  input: unknown,
  tenantId: bigint,
  actorId: bigint | null, // null = compra pública en línea, sin usuario del panel detrás
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
      // El vendedor llega por formulario y la FK apunta a vendedores(id) sin
      // restricción de tenant: hay que verificar que sea de esta empresa, o una
      // venta podría atribuirse (y comisionar) a un vendedor de otra.
      if (d.vendedor_id) {
        const ven = await tx.vendedores.findFirst({ where: { id: d.vendedor_id, tenant_id: tenantId }, select: { id: true } });
        if (!ven) return { ok: false as const, error: "Vendedor inválido." };
      }
      const compRows = await tx.$queryRawUnsafe<{ compartida: boolean }[]>(`SELECT compartida FROM saas.rifas WHERE id=$1::bigint`, d.rifa_id);
      const esCompartidaRifa = compRows[0]?.compartida ?? false;

      const boletas = await tx.$queryRawUnsafe<{ id: bigint; numero: number; estado: string; sede_id: bigint | null }[]>(
        `SELECT id, numero, estado, sede_id FROM saas.boletas
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

      // Sede de la venta: en rifa compartida la definen las boletas (deben ser de una
      // misma sede ya asignada); en rifa normal, la sede de la rifa.
      let sedeVenta = rifa.sede_id;
      if (esCompartidaRifa) {
        const sedes = [...new Set(boletas.map((b) => (b.sede_id === null ? null : String(b.sede_id))))];
        if (sedes.includes(null)) return { ok: false as const, error: "Hay boletas sin asignar a una sede; asígnalas antes de vender." };
        if (sedes.length > 1) return { ok: false as const, error: "No puedes vender boletas de distintas sedes en una misma venta." };
        sedeVenta = boletas[0].sede_id as bigint;
      }

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
          sede_id: sedeVenta,
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
    return { ok: false, error: mensajeError(e, "Error al crear la venta.") };
  }
}

export async function registrarAbono(
  tenantId: bigint,
  ventaId: bigint,
  datos: { monto: number | string; origen?: "pasarela" | "comprobante" | "efectivo" | "ajuste" },
  // null = acción del sistema (p. ej. confirmación automática de un webhook
  // de pago), sin un usuario humano detrás; auditar() ya admite actor nulo.
  actorId: bigint | null,
): Promise<Resultado<{ saldo: string; estado: string }>> {
  if (!(Number(datos.monto) > 0)) return { ok: false, error: "El monto debe ser positivo." };
  const montoTexto = String(datos.monto);

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<{ id: bigint; saldo: string; estado: string; excede: boolean }[]>(
        `SELECT id, saldo::text AS saldo, estado, (saldo < $3::numeric) AS excede
           FROM saas.ventas WHERE id=$1::bigint AND tenant_id=$2::bigint FOR UPDATE`,
        ventaId,
        tenantId,
        montoTexto,
      );
      const venta = filas[0];
      if (!venta) return { ok: false as const, error: "Venta no encontrada." };
      if (venta.estado === "anulada" || venta.estado === "pagada") {
        return { ok: false as const, error: `La venta está '${venta.estado}'.` };
      }
      // Sin esta guarda, GREATEST(saldo - monto, 0) absorbía el exceso: la venta
      // quedaba pagada pero la suma de abonos superaba el total, descuadrando el
      // recaudo, las comisiones y cualquier devolución posterior.
      if (venta.excede) {
        return { ok: false as const, error: `El abono excede el saldo pendiente (${venta.saldo}).` };
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
          WHERE id = $1::bigint AND tenant_id = $3::bigint
        RETURNING saldo::text AS saldo, estado`,
        ventaId,
        montoTexto,
        tenantId,
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
    return { ok: false, error: mensajeError(e, "Error al registrar el abono.") };
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
      // Igual que al registrar: la suma de abonos no puede superar el total.
      const tope = await tx.$queryRawUnsafe<{ excede: boolean; maximo: string }[]>(
        `SELECT (COALESCE(SUM(o.monto),0) + $3::numeric > v.total) AS excede,
                (v.total - COALESCE(SUM(o.monto),0))::text AS maximo
           FROM saas.ventas v
           LEFT JOIN saas.abonos o ON o.venta_id = v.id AND o.id <> $2::bigint
          WHERE v.id = $1::bigint
          GROUP BY v.total`,
        a.venta_id, abonoId, String(datos.monto),
      );
      if (tope[0]?.excede) return { ok: false as const, error: `El abono excede el total de la venta (máximo ${tope[0].maximo}).` };
      const origenOk = ["pasarela", "comprobante", "efectivo", "ajuste"].includes(String(datos.origen)) ? String(datos.origen) : "efectivo";
      await tx.$executeRawUnsafe(`UPDATE saas.abonos SET monto=$2::numeric, origen=$3::text WHERE id=$1::bigint`, abonoId, String(datos.monto), origenOk);
      const estado = await recalcularVenta(tx, a.venta_id);
      await auditar(tx, { tenantId, actorId, accion: "pago.abono", entidadTipo: "abono", entidadId: abonoId, despues: { editado: true, monto: String(datos.monto), origen: origenOk } });
      return { ok: true as const, data: { estado } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar el abono.") };
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
    return { ok: false, error: mensajeError(e, "Error al eliminar el abono.") };
  }
}

export async function anularVenta(
  tenantId: bigint,
  ventaId: bigint,
  motivo: string,
  actorId: bigint | null, // null = acción del sistema (p. ej. pago rechazado en un webhook)
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
      // El saldo se deja en 0: una venta anulada ya no es cartera. Antes conservaba
      // el saldo original y, aunque los listados filtran por estado, cualquier
      // SUM(saldo) sin ese filtro (o un cambio de estado posterior) lo reactivaba.
      await tx.ventas.update({ where: { id: ventaId }, data: { estado: "anulada", saldo: 0 } });
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
    return { ok: false, error: mensajeError(e, "Error al anular la venta.") };
  }
}
