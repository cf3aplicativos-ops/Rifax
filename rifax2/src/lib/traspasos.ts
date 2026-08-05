// Búsqueda de boleta por número + flujo de solicitud/autorización de traspaso
// entre vendedores y puntos de venta (sedes).
//
// Reglas de propiedad de una boleta DISPONIBLE:
//  - Si tiene talonario_id → la posee el vendedor de ese talonario.
//  - Si no tiene talonario_id → la posee el punto de venta (sede efectiva =
//    boletas.sede_id si la rifa es compartida, o rifas.sede_id si no lo es).
// El dueño puede venderla directo; cualquier otra parte debe solicitarla y
// esperar autorización del dueño. Al aprobarse, la comisión de la venta futura
// queda automáticamente del lado del nuevo dueño (la venta se atribuye a quien
// la vende, vía talonario_id / vendedor_id).
import "server-only";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";
import type { TenantUser } from "@/lib/auth/rbac";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type ContextoParte =
  | { tipo: "vendedor"; vendedorId: bigint; nombre: string }
  | { tipo: "sede"; sedeId: bigint; nombre: string };

// Deriva el "contexto" (quién actúa) desde el usuario en sesión: un vendedor
// actúa como tal; cualquier otro rol actúa como el punto de venta de su sede.
// Un admin/gerente sin sede fija no tiene un "punto de venta" único aquí (ver
// contextoDeUsuarioParaRifa para resolverlo dentro de una rifa concreta).
export async function contextoDeUsuario(tenantId: bigint, user: TenantUser): Promise<ContextoParte | null> {
  if (user.rol === "vendedor") {
    const v = await prisma.vendedores.findFirst({ where: { tenant_id: tenantId, usuario_id: user.id }, select: { id: true, nombre: true } });
    return v ? { tipo: "vendedor", vendedorId: v.id, nombre: v.nombre } : null;
  }
  if (user.sede) return { tipo: "sede", sedeId: user.sede.id, nombre: user.sede.nombre };
  return null;
}

// Igual, pero dentro de una rifa concreta: si el admin/gerente no tiene sede
// fija y la rifa NO es compartida, actúa implícitamente como la única sede de
// esa rifa (así puede vender/solicitar boletas de ella).
export async function contextoDeUsuarioParaRifa(tenantId: bigint, user: TenantUser, rifaId: bigint): Promise<ContextoParte | null> {
  const directo = await contextoDeUsuario(tenantId, user);
  if (directo) return directo;
  if (user.rol === "vendedor") return null;
  const filas = await prisma.$queryRawUnsafe<{ sede_id: bigint; compartida: boolean; sede_nombre: string }[]>(
    `SELECT r.sede_id, r.compartida, s.nombre AS sede_nombre FROM saas.rifas r JOIN saas.sedes s ON s.id = r.sede_id WHERE r.id=$1::bigint AND r.tenant_id=$2::bigint`,
    rifaId, tenantId,
  );
  const f = filas[0];
  if (f && !f.compartida) return { tipo: "sede", sedeId: f.sede_id, nombre: f.sede_nombre };
  return null;
}

// Autoridad para resolver solicitudes: el contexto exacto del propietario, o
// (solo para solicitudes cuyo dueño es una sede) un admin/gerente del tenant
// sin restricción de sede, que representa a todas las sedes de su empresa.
export type Autorizador = ContextoParte | { tipo: "admin_tenant" };

interface FilaBoleta {
  id: bigint; numero: number; estado: string;
  boleta_sede_id: bigint | null; talonario_id: bigint | null;
  talon_vendedor_id: bigint | null; talon_vendedor_nombre: string | null;
  rifa_sede_id: bigint; compartida: boolean;
  sede_nombre: string | null; sede_efectiva_id: bigint;
}

async function filaBoleta(tenantId: bigint, rifaId: bigint, numero: number): Promise<FilaBoleta | null> {
  const filas = await prisma.$queryRawUnsafe<FilaBoleta[]>(
    `SELECT b.id, b.numero, b.estado, b.sede_id AS boleta_sede_id, b.talonario_id,
            t.vendedor_id AS talon_vendedor_id, vd.nombre AS talon_vendedor_nombre,
            r.sede_id AS rifa_sede_id, r.compartida,
            COALESCE(sb.nombre, sr.nombre) AS sede_nombre,
            COALESCE(b.sede_id, r.sede_id) AS sede_efectiva_id
       FROM saas.boletas b
       JOIN saas.rifas r ON r.id = b.rifa_id
       LEFT JOIN saas.talonarios t ON t.id = b.talonario_id
       LEFT JOIN saas.vendedores vd ON vd.id = t.vendedor_id
       LEFT JOIN saas.sedes sb ON sb.id = b.sede_id
       LEFT JOIN saas.sedes sr ON sr.id = r.sede_id
      WHERE b.tenant_id = $1::bigint AND b.rifa_id = $2::bigint AND b.numero = $3::int`,
    tenantId, rifaId, numero,
  );
  return filas[0] ?? null;
}

export interface EstadoBoleta {
  numero: number;
  boletaId: string | null;
  resultado: "tuya" | "vendida" | "punto_de_venta" | "asignada_vendedor" | "no_disponible" | "no_existe";
  mensaje: string;
  propietario: { tipo: "vendedor" | "sede"; id: string; nombre: string } | null;
  puedeVenderDirecto: boolean;
  puedeSolicitar: boolean;
  solicitudPendienteId: string | null;
}

export async function buscarBoleta(tenantId: bigint, rifaId: bigint, numero: number, contexto: ContextoParte | null): Promise<EstadoBoleta> {
  const base = { numero, boletaId: null, propietario: null, puedeVenderDirecto: false, puedeSolicitar: false, solicitudPendienteId: null };
  const f = await filaBoleta(tenantId, rifaId, numero);
  if (!f) return { ...base, resultado: "no_existe", mensaje: "Ese número no existe en esta rifa." };

  if (f.estado === "reservada" || f.estado === "pagada") {
    return { ...base, boletaId: String(f.id), resultado: "vendida", mensaje: "Esta boleta ya está vendida." };
  }
  if (f.estado !== "disponible") {
    return { ...base, boletaId: String(f.id), resultado: "no_disponible", mensaje: `Boleta en estado '${f.estado}', no disponible.` };
  }

  // Boleta disponible: determinar dueño.
  const propietarioVendedor = f.talon_vendedor_id != null;
  const esTuya = contexto != null && (
    (propietarioVendedor && contexto.tipo === "vendedor" && contexto.vendedorId === f.talon_vendedor_id) ||
    (!propietarioVendedor && contexto.tipo === "sede" && contexto.sedeId === f.sede_efectiva_id)
  );

  if (esTuya) {
    return { ...base, boletaId: String(f.id), resultado: "tuya", mensaje: "Disponible: puedes venderla directamente.", puedeVenderDirecto: true };
  }

  // No es tuya: buscar si ya hay una solicitud pendiente tuya para esta boleta.
  let solicitudPendienteId: string | null = null;
  if (contexto) {
    const pend = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT id FROM saas.solicitudes_boleta
        WHERE boleta_id=$1::bigint AND estado='pendiente'
          AND ${contexto.tipo === "vendedor" ? "solicitante_vendedor_id=$2::bigint" : "solicitante_sede_id=$2::bigint"}`,
      f.id, contexto.tipo === "vendedor" ? contexto.vendedorId : contexto.sedeId,
    );
    solicitudPendienteId = pend[0] ? String(pend[0].id) : null;
  }

  if (propietarioVendedor) {
    return {
      ...base, boletaId: String(f.id), resultado: "asignada_vendedor",
      mensaje: `Disponible, asignada al vendedor ${f.talon_vendedor_nombre ?? "—"}.`,
      propietario: { tipo: "vendedor", id: String(f.talon_vendedor_id), nombre: f.talon_vendedor_nombre ?? "—" },
      puedeSolicitar: contexto != null && !solicitudPendienteId,
      solicitudPendienteId,
    };
  }
  return {
    ...base, boletaId: String(f.id), resultado: "punto_de_venta",
    mensaje: `Disponible en el punto de venta${f.sede_nombre ? ` (${f.sede_nombre})` : ""}.`,
    propietario: { tipo: "sede", id: String(f.sede_efectiva_id), nombre: f.sede_nombre ?? "—" },
    puedeSolicitar: contexto != null && !solicitudPendienteId,
    solicitudPendienteId,
  };
}

export async function crearSolicitudTraspaso(
  tenantId: bigint, rifaId: bigint, numero: number, contexto: ContextoParte, actorId: bigint,
): Promise<Resultado<{ solicitudId: string }>> {
  const f = await filaBoleta(tenantId, rifaId, numero);
  if (!f) return { ok: false, error: "Boleta no encontrada." };
  if (f.estado !== "disponible") return { ok: false, error: "La boleta no está disponible." };

  const propietarioVendedor = f.talon_vendedor_id != null;
  const propTipo: "vendedor" | "sede" = propietarioVendedor ? "vendedor" : "sede";
  const propId = propietarioVendedor ? f.talon_vendedor_id! : f.sede_efectiva_id;

  const esPropia =
    (contexto.tipo === "vendedor" && propTipo === "vendedor" && contexto.vendedorId === propId) ||
    (contexto.tipo === "sede" && propTipo === "sede" && contexto.sedeId === propId);
  if (esPropia) return { ok: false, error: "Esa boleta ya es tuya." };

  try {
    const r = await prisma.$executeRawUnsafe(
      `INSERT INTO saas.solicitudes_boleta
         (tenant_id, rifa_id, boleta_id, numero,
          solicitante_tipo, solicitante_vendedor_id, solicitante_sede_id,
          propietario_tipo, propietario_vendedor_id, propietario_sede_id,
          solicitado_por)
       VALUES ($1::bigint,$2::bigint,$3::bigint,$4::int,
               $5::text,$6::bigint,$7::bigint,
               $8::text,$9::bigint,$10::bigint,
               $11::bigint)`,
      tenantId, rifaId, f.id, numero,
      contexto.tipo, contexto.tipo === "vendedor" ? contexto.vendedorId : null, contexto.tipo === "sede" ? contexto.sedeId : null,
      propTipo, propTipo === "vendedor" ? propId : null, propTipo === "sede" ? propId : null,
      actorId,
    );
    if (!r) return { ok: false, error: "No se pudo registrar la solicitud." };
    const fila = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT id FROM saas.solicitudes_boleta WHERE boleta_id=$1::bigint AND estado='pendiente' ORDER BY id DESC LIMIT 1`,
      f.id,
    );
    await auditar(prisma, {
      tenantId, actorId, accion: "boleta.solicitar", entidadTipo: "boleta", entidadId: f.id,
      despues: { numero, solicitante: contexto.tipo === "vendedor" ? contexto.nombre : contexto.nombre, propietario: propTipo },
    });
    return { ok: true, data: { solicitudId: String(fila[0]?.id ?? "") } };
  } catch (e) {
    // El índice único evita solicitudes duplicadas pendientes para la misma boleta.
    if (e instanceof Error && /uq_solicitud_pendiente_boleta/.test(e.message)) {
      return { ok: false, error: "Ya hay una solicitud pendiente para esta boleta." };
    }
    return { ok: false, error: mensajeError(e, "Error al crear la solicitud.") };
  }
}

export interface SolicitudFila {
  id: string; numero: string; rifa: string; rifaId: string;
  solicitante: string; propietario: string;
  estado: string; motivoRechazo: string | null;
  creadoEn: Date; resueltoEn: Date | null;
}

function whereContexto(col: "solicitante" | "propietario", contexto: ContextoParte): string {
  return contexto.tipo === "vendedor" ? `${col}_vendedor_id = $2::bigint` : `${col}_sede_id = $2::bigint`;
}

const SEL_SOLICITUD = `s.id, s.numero, r.codigo AS rifa, s.rifa_id,
            COALESCE(sv.nombre, ss.nombre, '—') AS solicitante,
            COALESCE(pv.nombre, ps.nombre, '—') AS propietario,
            s.estado, s.motivo_rechazo, s.creado_en, s.resuelto_en
       FROM saas.solicitudes_boleta s
       JOIN saas.rifas r ON r.id = s.rifa_id
       LEFT JOIN saas.vendedores sv ON sv.id = s.solicitante_vendedor_id
       LEFT JOIN saas.sedes ss ON ss.id = s.solicitante_sede_id
       LEFT JOIN saas.vendedores pv ON pv.id = s.propietario_vendedor_id
       LEFT JOIN saas.sedes ps ON ps.id = s.propietario_sede_id`;

function mapSolicitud(f: { id: bigint; numero: number; rifa: string; rifa_id: bigint; solicitante: string; propietario: string; estado: string; motivo_rechazo: string | null; creado_en: Date; resuelto_en: Date | null }): SolicitudFila {
  return {
    id: String(f.id), numero: String(f.numero), rifa: f.rifa, rifaId: String(f.rifa_id),
    solicitante: f.solicitante, propietario: f.propietario, estado: f.estado, motivoRechazo: f.motivo_rechazo,
    creadoEn: f.creado_en, resueltoEn: f.resuelto_en,
  };
}
type FilaCruda = Parameters<typeof mapSolicitud>[0];

export async function listarSolicitudesRecibidas(tenantId: bigint, contexto: ContextoParte): Promise<SolicitudFila[]> {
  const idVal = contexto.tipo === "vendedor" ? contexto.vendedorId : contexto.sedeId;
  const filas = await prisma.$queryRawUnsafe<FilaCruda[]>(
    `SELECT ${SEL_SOLICITUD}
      WHERE s.tenant_id = $1::bigint AND ${whereContexto("propietario", contexto)}
      ORDER BY (s.estado = 'pendiente') DESC, s.creado_en DESC
      LIMIT 100`,
    tenantId, idVal,
  );
  return filas.map(mapSolicitud);
}

// Para un admin/gerente sin sede fija: todas las solicitudes dirigidas a
// cualquier sede de su empresa (representan al tenant completo).
export async function listarSolicitudesRecibidasTenant(tenantId: bigint): Promise<SolicitudFila[]> {
  const filas = await prisma.$queryRawUnsafe<FilaCruda[]>(
    `SELECT ${SEL_SOLICITUD}
      WHERE s.tenant_id = $1::bigint AND s.propietario_tipo = 'sede'
      ORDER BY (s.estado = 'pendiente') DESC, s.creado_en DESC
      LIMIT 100`,
    tenantId,
  );
  return filas.map(mapSolicitud);
}

export async function listarSolicitudesEnviadas(tenantId: bigint, contexto: ContextoParte): Promise<SolicitudFila[]> {
  const idVal = contexto.tipo === "vendedor" ? contexto.vendedorId : contexto.sedeId;
  const filas = await prisma.$queryRawUnsafe<FilaCruda[]>(
    `SELECT ${SEL_SOLICITUD}
      WHERE s.tenant_id = $1::bigint AND ${whereContexto("solicitante", contexto)}
      ORDER BY s.creado_en DESC
      LIMIT 100`,
    tenantId, idVal,
  );
  return filas.map(mapSolicitud);
}

export async function resolverSolicitud(
  tenantId: bigint, solicitudId: bigint, aprobar: boolean, contexto: Autorizador, actorId: bigint, motivo?: string,
): Promise<Resultado> {
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRawUnsafe<
        { id: bigint; boleta_id: bigint; rifa_id: bigint; numero: number; estado: string;
          solicitante_tipo: string; solicitante_vendedor_id: bigint | null; solicitante_sede_id: bigint | null;
          propietario_tipo: string; propietario_vendedor_id: bigint | null; propietario_sede_id: bigint | null }[]
      >(
        `SELECT id, boleta_id, rifa_id, numero, estado,
                solicitante_tipo, solicitante_vendedor_id, solicitante_sede_id,
                propietario_tipo, propietario_vendedor_id, propietario_sede_id
           FROM saas.solicitudes_boleta WHERE id=$1::bigint AND tenant_id=$2::bigint FOR UPDATE`,
        solicitudId, tenantId,
      );
      const s = filas[0];
      if (!s) return { ok: false as const, error: "Solicitud no encontrada." };
      if (s.estado !== "pendiente") return { ok: false as const, error: "Esta solicitud ya fue resuelta." };

      // Verifica que quien resuelve sea efectivamente el propietario (defensa en profundidad).
      // Excepción: un admin/gerente sin sede fija representa a todas las sedes de su
      // empresa y puede resolver solicitudes cuyo dueño es una sede (nunca las de un
      // vendedor: esas solo las autoriza el vendedor dueño).
      const autorizado =
        (s.propietario_tipo === "vendedor" && contexto.tipo === "vendedor" && contexto.vendedorId === s.propietario_vendedor_id) ||
        (s.propietario_tipo === "sede" && contexto.tipo === "sede" && contexto.sedeId === s.propietario_sede_id) ||
        (s.propietario_tipo === "sede" && contexto.tipo === "admin_tenant");
      if (!autorizado) return { ok: false as const, error: "No tienes autorización para resolver esta solicitud." };

      if (!aprobar) {
        await tx.$executeRawUnsafe(
          `UPDATE saas.solicitudes_boleta SET estado='rechazada', motivo_rechazo=$2::text, resuelto_por=$3::bigint, resuelto_en=now() WHERE id=$1::bigint`,
          solicitudId, motivo?.trim() || null, actorId,
        );
        await auditar(tx, { tenantId, actorId, accion: "boleta.rechazar", entidadTipo: "boleta", entidadId: s.boleta_id, despues: { numero: s.numero, motivo: motivo?.trim() || null } });
        return { ok: true as const };
      }

      // Re-verifica disponibilidad al momento de aprobar (pudo venderse mientras tanto).
      const bol = await tx.$queryRawUnsafe<{ estado: string }[]>(`SELECT estado FROM saas.boletas WHERE id=$1::bigint FOR UPDATE`, s.boleta_id);
      if (!bol[0] || bol[0].estado !== "disponible") {
        await tx.$executeRawUnsafe(
          `UPDATE saas.solicitudes_boleta SET estado='rechazada', motivo_rechazo='La boleta ya no está disponible.', resuelto_por=$2::bigint, resuelto_en=now() WHERE id=$1::bigint`,
          solicitudId, actorId,
        );
        return { ok: false as const, error: "La boleta ya no está disponible; la solicitud se marcó como rechazada." };
      }

      const rifaRow = await tx.$queryRawUnsafe<{ compartida: boolean }[]>(`SELECT compartida FROM saas.rifas WHERE id=$1::bigint`, s.rifa_id);
      const compartida = rifaRow[0]?.compartida ?? false;

      if (s.solicitante_tipo === "vendedor") {
        // Busca un talonario abierto del vendedor solicitante para esta rifa, o crea uno de una boleta.
        let tal = await tx.talonarios.findFirst({
          where: { tenant_id: tenantId, rifa_id: s.rifa_id, vendedor_id: s.solicitante_vendedor_id!, estado: { not: "cerrado" } },
          select: { id: true },
        });
        if (!tal) {
          tal = await tx.talonarios.create({
            data: {
              tenant_id: tenantId, rifa_id: s.rifa_id, vendedor_id: s.solicitante_vendedor_id!,
              numero_inicio: s.numero, numero_fin: s.numero, estado: "asignado", tipo: "aleatoria",
            },
            select: { id: true },
          });
        }
        // Conserva sede_id si la rifa es compartida (sigue siendo inventario de esa sede).
        await tx.$executeRawUnsafe(`UPDATE saas.boletas SET talonario_id=$1::bigint WHERE id=$2::bigint`, tal.id, s.boleta_id);
      } else {
        // Vuelve al pool general del punto de venta solicitante.
        await tx.$executeRawUnsafe(
          `UPDATE saas.boletas SET talonario_id=NULL${compartida ? ", sede_id=$2::bigint" : ""} WHERE id=$1::bigint`,
          s.boleta_id, s.solicitante_sede_id,
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE saas.solicitudes_boleta SET estado='aprobada', resuelto_por=$2::bigint, resuelto_en=now() WHERE id=$1::bigint`,
        solicitudId, actorId,
      );
      await auditar(tx, {
        tenantId, actorId, accion: "boleta.traspasar", entidadTipo: "boleta", entidadId: s.boleta_id,
        antes: { propietario_tipo: s.propietario_tipo }, despues: { numero: s.numero, nuevo_propietario_tipo: s.solicitante_tipo },
      });
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al resolver la solicitud.") };
  }
}
