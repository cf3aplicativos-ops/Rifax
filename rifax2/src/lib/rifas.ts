// Servicio de rifas (multi-tenant). Toda consulta se filtra por tenant; el SQL
// crudo se cualifica saas.*. Cada rifa pertenece a una sede.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";

export const crearRifaSchema = z.object({
  sede_id: z.coerce.bigint(),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().optional(),
  loteria: z.string().optional(),
  numero_digitos: z.coerce.number().int().min(2).max(6),
  precio_boleta: z.coerce.number().positive("El precio debe ser mayor que 0."),
  fecha_apertura: z.string().min(1, "Indica la fecha de apertura."),
  fecha_cierre_ventas: z.string().min(1, "Indica el cierre de ventas."),
  fecha_sorteo: z.string().min(1, "Indica la fecha del sorteo."),
  tasa_derechos: z.coerce.number().min(0).max(1).optional(),
  compartida: z.coerce.boolean().optional().default(false),
});

// Edición posterior a la creación: no incluye sede_id, numero_digitos ni
// compartida (afectan el rango/generación de boletas ya creadas; cambiarlos
// requeriría un flujo aparte, no una simple edición de datos).
export const editarRifaSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  descripcion: z.string().optional(),
  loteria: z.string().optional(),
  precio_boleta: z.coerce.number().positive("El precio debe ser mayor que 0."),
  fecha_apertura: z.string().min(1, "Indica la fecha de apertura."),
  fecha_cierre_ventas: z.string().min(1, "Indica el cierre de ventas."),
  fecha_sorteo: z.string().min(1, "Indica la fecha del sorteo."),
  tasa_derechos: z.coerce.number().min(0).max(1).optional(),
});

/** Sedes que un usuario puede operar: la suya si está acotado, o todas las activas. */
export async function sedesOperables(tenantId: bigint, sedeId: bigint | null) {
  return prisma.sedes.findMany({
    where: { tenant_id: tenantId, estado: "activa", ...(sedeId ? { id: sedeId } : {}) },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

export async function listarRifas(tenantId: bigint, sedeId: bigint | null, vendedorId?: bigint | null) {
  return prisma.rifas.findMany({
    where: {
      tenant_id: tenantId,
      ...(sedeId ? { sede_id: sedeId } : {}),
      // Un vendedor solo ve las rifas donde tiene talonarios.
      ...(vendedorId ? { talonarios: { some: { vendedor_id: vendedorId } } } : {}),
    },
    orderBy: { id: "desc" },
    include: { sedes: { select: { nombre: true } } },
  });
}

export async function obtenerRifa(tenantId: bigint, id: bigint) {
  return prisma.rifas.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      premios: { orderBy: { orden: "asc" } },
      premios_anticipados: { orderBy: { fecha_juego: "asc" } },
      sedes: { select: { nombre: true } },
    },
  });
}

// Resumen de boletas por sede para las rifas compartidas (para la lista de rifas).
export interface ResumenSede { sede: string; disponibles: number; total: number }
export async function resumenSedesCompartidas(tenantId: bigint): Promise<Record<string, ResumenSede[]>> {
  const filas = await prisma.$queryRawUnsafe<{ rifa_id: bigint; sede: string; disp: bigint; tot: bigint }[]>(
    `SELECT b.rifa_id,
            COALESCE(s.nombre, 'sin asignar') AS sede,
            COUNT(*) FILTER (WHERE b.estado = 'disponible') AS disp,
            COUNT(*) AS tot
       FROM saas.boletas b
       JOIN saas.rifas r ON r.id = b.rifa_id AND r.compartida = true
       LEFT JOIN saas.sedes s ON s.id = b.sede_id
      WHERE b.tenant_id = $1::bigint
      GROUP BY b.rifa_id, sede
      ORDER BY b.rifa_id, sede`,
    tenantId,
  );
  const m: Record<string, ResumenSede[]> = {};
  for (const f of filas) {
    (m[String(f.rifa_id)] ??= []).push({ sede: f.sede, disponibles: Number(f.disp), total: Number(f.tot) });
  }
  return m;
}

export async function esCompartida(tenantId: bigint, rifaId: bigint): Promise<boolean> {
  const f = await prisma.$queryRawUnsafe<{ compartida: boolean }[]>(`SELECT compartida FROM saas.rifas WHERE id=$1::bigint AND tenant_id=$2::bigint`, rifaId, tenantId);
  return f[0]?.compartida ?? false;
}

// ---------- Distribución de una rifa compartida entre sedes (#2, #6) ----------
export interface DistribSede { sedeId: string; nombre: string; asignadas: number; disponibles: number; vendidas: number }

export async function distribucionPorSede(tenantId: bigint, rifaId: bigint): Promise<{ sinAsignar: number; sedes: DistribSede[] }> {
  const [sedes, sin] = await Promise.all([
    prisma.$queryRawUnsafe<{ sede_id: bigint; nombre: string; asignadas: bigint; disponibles: bigint; vendidas: bigint }[]>(
      `SELECT s.id AS sede_id, s.nombre,
              COUNT(b.id) AS asignadas,
              COUNT(b.id) FILTER (WHERE b.estado = 'disponible') AS disponibles,
              COUNT(b.id) FILTER (WHERE b.estado IN ('reservada','pagada')) AS vendidas
         FROM saas.sedes s
         JOIN saas.boletas b ON b.sede_id = s.id AND b.rifa_id = $2::bigint
        WHERE s.tenant_id = $1::bigint
        GROUP BY s.id, s.nombre
        ORDER BY s.nombre`,
      tenantId, rifaId,
    ),
    prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM saas.boletas WHERE tenant_id=$1::bigint AND rifa_id=$2::bigint AND sede_id IS NULL`,
      tenantId, rifaId,
    ),
  ]);
  return {
    sinAsignar: Number(sin[0]?.n ?? 0),
    sedes: sedes.map((s) => ({ sedeId: String(s.sede_id), nombre: s.nombre, asignadas: Number(s.asignadas), disponibles: Number(s.disponibles), vendidas: Number(s.vendidas) })),
  };
}

// Números DISPONIBLES asignados a una sede (para mostrarlos en lista; los vendidos ya no aparecen).
export async function boletasDisponiblesSede(tenantId: bigint, rifaId: bigint, sedeId: bigint, limite = 500): Promise<number[]> {
  const filas = await prisma.$queryRawUnsafe<{ numero: number }[]>(
    `SELECT numero FROM saas.boletas
      WHERE tenant_id=$1::bigint AND rifa_id=$2::bigint AND sede_id=$3::bigint AND estado='disponible'
      ORDER BY numero ASC LIMIT $4::int`,
    tenantId, rifaId, sedeId, limite,
  );
  return filas.map((f) => f.numero);
}

// Asigna boletas (aún sin sede) a una sede por rango consecutivo, aleatorio o específicas.
export async function asignarBoletasSede(
  tenantId: bigint,
  rifaId: bigint,
  sedeId: bigint,
  datos: { tipo: "consecutiva" | "aleatoria" | "especificas"; inicio?: number; fin?: number; cantidad?: number; numeros?: number[] },
  actorId: bigint,
): Promise<{ ok: true; data: { asignadas: number } } | { ok: false; error: string }> {
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId }, select: { numero_min: true, numero_max: true, codigo: true } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  // boletas.sede_id solo tiene sentido en una rifa compartida; en una rifa normal
  // la sede la define la propia rifa y marcar las boletas dejaría dos fuentes de
  // verdad en conflicto (crearVenta y los traspasos leen COALESCE(b.sede_id, r.sede_id)).
  if (!(await esCompartida(tenantId, rifaId))) {
    return { ok: false, error: "Esta rifa no es compartida: sus boletas pertenecen a la sede de la rifa." };
  }
  const sede = await prisma.sedes.findFirst({ where: { id: sedeId, tenant_id: tenantId }, select: { nombre: true } });
  if (!sede) return { ok: false, error: "Sede inválida." };

  try {
    return await prisma.$transaction(async (tx) => {
      let ids: bigint[] = [];
      if (datos.tipo === "consecutiva") {
        const ini = datos.inicio ?? -1, fin = datos.fin ?? -1;
        if (!Number.isInteger(ini) || !Number.isInteger(fin) || fin < ini) return { ok: false as const, error: "Rango inválido." };
        const filas = await tx.$queryRawUnsafe<{ id: bigint }[]>(
          `SELECT id FROM saas.boletas WHERE rifa_id=$1::bigint AND sede_id IS NULL AND estado='disponible' AND numero BETWEEN $2::int AND $3::int FOR UPDATE`,
          rifaId, ini, fin,
        );
        ids = filas.map((f) => f.id);
        if (ids.length === 0) return { ok: false as const, error: "No hay boletas sin asignar en ese rango." };
      } else if (datos.tipo === "aleatoria") {
        const n = datos.cantidad ?? 0;
        if (n < 1) return { ok: false as const, error: "Indica una cantidad válida." };
        const filas = await tx.$queryRawUnsafe<{ id: bigint }[]>(
          `SELECT id FROM saas.boletas WHERE rifa_id=$1::bigint AND sede_id IS NULL AND estado='disponible' ORDER BY random() LIMIT $2::int FOR UPDATE SKIP LOCKED`,
          rifaId, n,
        );
        ids = filas.map((f) => f.id);
        if (ids.length < n) return { ok: false as const, error: `Solo hay ${ids.length} boletas sin asignar disponibles.` };
      } else {
        const nums = [...new Set(datos.numeros ?? [])].filter((x) => Number.isInteger(x) && x >= 0);
        if (nums.length === 0) return { ok: false as const, error: "Indica los números." };
        const filas = await tx.$queryRawUnsafe<{ id: bigint; numero: number; sede_id: bigint | null; estado: string }[]>(
          `SELECT id, numero, sede_id, estado FROM saas.boletas WHERE rifa_id=$1::bigint AND numero = ANY($2::int[]) FOR UPDATE`,
          rifaId, nums,
        );
        if (filas.length !== nums.length) {
          const enc = new Set(filas.map((f) => f.numero));
          return { ok: false as const, error: `Números inexistentes: ${nums.filter((n) => !enc.has(n)).join(", ")}.` };
        }
        const ocup = filas.filter((f) => f.sede_id !== null || f.estado !== "disponible").map((f) => f.numero);
        if (ocup.length) return { ok: false as const, error: `Ya asignadas o no disponibles: ${ocup.join(", ")}.` };
        ids = filas.map((f) => f.id);
      }

      await tx.$executeRawUnsafe(`UPDATE saas.boletas SET sede_id=$1::bigint WHERE id = ANY($2::bigint[])`, sedeId, ids);
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "rifa", entidadId: rifaId, despues: { compartida_asignar: sede.nombre, cantidad: ids.length } });
      return { ok: true as const, data: { asignadas: ids.length } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al asignar boletas.") };
  }
}

// Libera (des-asigna) las boletas DISPONIBLES de una sede (no toca las vendidas).
export async function liberarBoletasSede(tenantId: bigint, rifaId: bigint, sedeId: bigint, actorId: bigint): Promise<{ ok: true; data: { liberadas: number } } | { ok: false; error: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const n = await tx.$executeRawUnsafe(
        `UPDATE saas.boletas SET sede_id=NULL WHERE tenant_id=$1::bigint AND rifa_id=$2::bigint AND sede_id=$3::bigint AND estado='disponible' AND talonario_id IS NULL`,
        tenantId, rifaId, sedeId,
      );
      const liberadas = typeof n === "number" ? n : 0;
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "rifa", entidadId: rifaId, despues: { compartida_liberar: String(sedeId), cantidad: liberadas } });
      return { ok: true as const, data: { liberadas } };
    });
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al liberar boletas.") };
  }
}

export async function agregarPremioAnticipado(
  tenantId: bigint,
  rifaId: bigint,
  datos: { nombre: string; loteria?: string; fecha_juego: string; pagos_requeridos?: number; valor_estimado?: number | null },
  actorId: bigint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!datos.nombre?.trim()) return { ok: false, error: "El nombre del premio es obligatorio." };
  if (!datos.fecha_juego) return { ok: false, error: "La fecha de juego es obligatoria." };
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  try {
    await prisma.$transaction(async (tx) => {
      const p = await tx.premios_anticipados.create({
        data: {
          tenant_id: tenantId,
          rifa_id: rifaId,
          nombre: datos.nombre.trim(),
          loteria: datos.loteria || null,
          fecha_juego: new Date(datos.fecha_juego),
          pagos_requeridos: datos.pagos_requeridos && datos.pagos_requeridos >= 1 ? datos.pagos_requeridos : 1,
          valor_estimado: datos.valor_estimado ?? null,
          estado: "programado",
        },
      });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio_anticipado", entidadId: p.id, despues: { rifa: rifa.codigo, nombre: datos.nombre.trim(), fecha: datos.fecha_juego } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al agregar el premio anticipado.") };
  }
}

export async function agregarPremio(
  tenantId: bigint,
  rifaId: bigint,
  datos: { nombre: string; valorEstimado?: number | null },
  actorId: bigint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!datos.nombre?.trim()) return { ok: false, error: "El nombre del premio es obligatorio." };
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  if (["sorteada", "liquidada", "archivada"].includes(rifa.estado)) {
    return { ok: false, error: `No se pueden agregar premios a una rifa '${rifa.estado}'.` };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const max = await tx.premios.aggregate({ where: { rifa_id: rifaId }, _max: { orden: true } });
      const premio = await tx.premios.create({
        data: { rifa_id: rifaId, orden: (max._max.orden ?? 0) + 1, nombre: datos.nombre.trim(), valor_estimado: datos.valorEstimado ?? null },
      });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio", entidadId: premio.id, despues: { rifa: rifa.codigo, nombre: datos.nombre.trim() } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al agregar el premio.") };
  }
}

// Imágenes propias de la rifa (data URI): logo para el recibo y la boleta.
const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const COLS_IMG = { logo: "logo_url", boleta: "boleta_url" } as const;
type ImgRifa = keyof typeof COLS_IMG;
const LIMITE_IMG_RIFA: Record<ImgRifa, number> = { logo: 400 * 1024, boleta: 1_500 * 1024 };

export async function guardarImagenRifa(tenantId: bigint, rifaId: bigint, tipo: ImgRifa, file: File | null, quitar: boolean, actorId: bigint): Promise<{ ok: true } | { ok: false; error: string }> {
  const col = COLS_IMG[tipo];
  const rifa = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId }, select: { id: true } });
  if (!rifa) return { ok: false, error: "Rifa no encontrada." };
  if (quitar) {
    await prisma.$executeRawUnsafe(`UPDATE saas.rifas SET ${col}=NULL WHERE id=$1::bigint`, rifaId);
    return { ok: true };
  }
  if (!file || file.size === 0) return { ok: false, error: "Selecciona una imagen." };
  if (!TIPOS_LOGO.includes(file.type)) return { ok: false, error: "Formato no soportado (PNG, JPG, WEBP o SVG)." };
  if (file.size > LIMITE_IMG_RIFA[tipo]) return { ok: false, error: `La imagen supera ${Math.round(LIMITE_IMG_RIFA[tipo] / 1024)} KB.` };
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE saas.rifas SET ${col}=$1 WHERE id=$2::bigint`, `data:${file.type};base64,${b64}`, rifaId);
    await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "rifa", entidadId: rifaId, despues: { imagen: tipo } });
  });
  return { ok: true };
}

// Compatibilidad: helpers específicos.
export function guardarLogoRifa(tenantId: bigint, rifaId: bigint, file: File | null, quitar: boolean, actorId: bigint) {
  return guardarImagenRifa(tenantId, rifaId, "logo", file, quitar, actorId);
}
export function guardarBoletaRifa(tenantId: bigint, rifaId: bigint, file: File | null, quitar: boolean, actorId: bigint) {
  return guardarImagenRifa(tenantId, rifaId, "boleta", file, quitar, actorId);
}

export async function imagenesRifa(tenantId: bigint, rifaId: bigint): Promise<{ logo: string | null; boleta: string | null }> {
  const filas = await prisma.$queryRawUnsafe<{ logo_url: string | null; boleta_url: string | null }[]>(
    `SELECT logo_url, boleta_url FROM saas.rifas WHERE id=$1::bigint AND tenant_id=$2::bigint`, rifaId, tenantId,
  );
  return { logo: filas[0]?.logo_url ?? null, boleta: filas[0]?.boleta_url ?? null };
}
export async function logoRifa(tenantId: bigint, rifaId: bigint): Promise<string | null> {
  return (await imagenesRifa(tenantId, rifaId)).logo;
}

export async function editarPremioAnticipado(
  tenantId: bigint,
  premioId: bigint,
  datos: { nombre: string; loteria?: string; fecha_juego: string; pagos_requeridos?: number; valor_estimado?: number | null },
  actorId: bigint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!datos.nombre?.trim()) return { ok: false, error: "El nombre del premio es obligatorio." };
  if (!datos.fecha_juego) return { ok: false, error: "La fecha de juego es obligatoria." };
  const pa = await prisma.premios_anticipados.findFirst({ where: { id: premioId, tenant_id: tenantId } });
  if (!pa) return { ok: false, error: "Premio anticipado no encontrado." };
  if (pa.estado === "jugado") return { ok: false, error: "No se puede editar un premio ya jugado." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.premios_anticipados.update({
        where: { id: premioId },
        data: {
          nombre: datos.nombre.trim(),
          loteria: datos.loteria || null,
          fecha_juego: new Date(datos.fecha_juego),
          pagos_requeridos: datos.pagos_requeridos && datos.pagos_requeridos >= 1 ? datos.pagos_requeridos : 1,
          valor_estimado: datos.valor_estimado ?? null,
        },
      });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio_anticipado", entidadId: premioId, despues: { nombre: datos.nombre.trim(), fecha: datos.fecha_juego } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al editar el premio anticipado.") };
  }
}

export async function eliminarPremioAnticipado(tenantId: bigint, premioId: bigint, actorId: bigint): Promise<{ ok: true } | { ok: false; error: string }> {
  const pa = await prisma.premios_anticipados.findFirst({ where: { id: premioId, tenant_id: tenantId } });
  if (!pa) return { ok: false, error: "Premio anticipado no encontrado." };
  if (pa.estado === "jugado") return { ok: false, error: "No se puede eliminar un premio ya jugado." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.premios_anticipados.delete({ where: { id: premioId } });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio_anticipado", entidadId: premioId, despues: { eliminado: true } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al eliminar el premio anticipado.") };
  }
}

export async function eliminarPremio(tenantId: bigint, premioId: bigint, actorId: bigint): Promise<{ ok: true } | { ok: false; error: string }> {
  const premio = await prisma.premios.findFirst({ where: { id: premioId }, include: { rifas: { select: { tenant_id: true, estado: true, codigo: true } } } });
  if (!premio || premio.rifas.tenant_id !== tenantId) return { ok: false, error: "Premio no encontrado." };
  if (["sorteada", "liquidada", "archivada"].includes(premio.rifas.estado)) {
    return { ok: false, error: `No se pueden eliminar premios de una rifa '${premio.rifas.estado}'.` };
  }
  const sorteado = await prisma.sorteos.findFirst({ where: { premio_id: premioId } });
  if (sorteado) return { ok: false, error: "No se puede eliminar un premio ya sorteado." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.premios.delete({ where: { id: premioId } });
      await auditar(tx, { tenantId, actorId, accion: "rifa.editar", entidadTipo: "premio", entidadId: premioId, despues: { eliminado: true } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al eliminar el premio.") };
  }
}

export async function crearRifa(
  input: unknown,
  tenantId: bigint,
  sedeIdUsuario: bigint | null,
  actorId: bigint,
) {
  const parsed = crearRifaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  // Si el usuario está acotado a una sede, la rifa solo puede crearse para
  // esa sede (comprobación aparte: un `id` duplicado en el mismo objeto
  // `where` haría que la segunda clave silenciosamente sobrescribiera a la
  // primera, dejando pasar cualquier sede_id que llegara en el formulario).
  if (sedeIdUsuario && d.sede_id !== sedeIdUsuario) {
    return { ok: false as const, error: "Sede inválida o no permitida." };
  }
  // La sede debe pertenecer al tenant y estar activa.
  const sede = await prisma.sedes.findFirst({
    where: { id: d.sede_id, tenant_id: tenantId, estado: "activa" },
  });
  if (!sede) return { ok: false as const, error: "Sede inválida o no permitida." };

  const cierre = new Date(d.fecha_cierre_ventas);
  const sorteo = new Date(d.fecha_sorteo);
  if (cierre > sorteo) {
    return { ok: false as const, error: "El cierre de ventas debe ser anterior o igual al sorteo." };
  }

  const numeroMax = Math.pow(10, d.numero_digitos) - 1;

  const rifa = await prisma.$transaction(async (tx) => {
    const creada = await tx.rifas.create({
      data: {
        tenant_id: tenantId,
        sede_id: d.sede_id,
        codigo: `TMP-${randomUUID()}`,
        nombre: d.nombre,
        descripcion: d.descripcion || null,
        loteria: d.loteria || null,
        numero_digitos: d.numero_digitos,
        numero_min: 0,
        numero_max: numeroMax,
        precio_boleta: d.precio_boleta,
        fecha_apertura: new Date(d.fecha_apertura),
        fecha_cierre_ventas: cierre,
        fecha_sorteo: sorteo,
        tasa_derechos: d.tasa_derechos ?? 0.14,
        total_boletas: numeroMax + 1,
        creado_por: actorId,
      },
    });
    const codigo = `RFX-${new Date().getFullYear()}-${String(creada.id).padStart(4, "0")}`;
    const actualizada = await tx.rifas.update({ where: { id: creada.id }, data: { codigo } });
    // Marca de rifa compartida (columna fuera del modelo Prisma).
    if (d.compartida) {
      await tx.$executeRawUnsafe(`UPDATE saas.rifas SET compartida = true WHERE id = $1::bigint`, creada.id);
    }

    await auditar(tx, {
      tenantId,
      actorId,
      accion: "rifa.crear",
      entidadTipo: "rifa",
      entidadId: creada.id,
      despues: { codigo, nombre: d.nombre, sede: sede.nombre, compartida: d.compartida, total_boletas: numeroMax + 1 },
    });
    return actualizada;
  }, { maxWait: 15_000, timeout: 30_000 });

  return { ok: true as const, rifa };
}

export async function editarRifa(tenantId: bigint, rifaId: bigint, input: unknown, actorId: bigint) {
  const parsed = editarRifaSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const cierre = new Date(d.fecha_cierre_ventas);
  const sorteo = new Date(d.fecha_sorteo);
  if (cierre > sorteo) return { ok: false as const, error: "El cierre de ventas debe ser anterior o igual al sorteo." };

  const actual = await prisma.rifas.findFirst({ where: { id: rifaId, tenant_id: tenantId } });
  if (!actual) return { ok: false as const, error: "Rifa no encontrada." };
  if (["sorteada", "liquidada", "archivada"].includes(actual.estado)) {
    return { ok: false as const, error: `No se puede editar una rifa '${actual.estado}'.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rifas.update({
        where: { id: rifaId },
        data: {
          nombre: d.nombre,
          descripcion: d.descripcion || null,
          loteria: d.loteria || null,
          precio_boleta: d.precio_boleta,
          fecha_apertura: new Date(d.fecha_apertura),
          fecha_cierre_ventas: cierre,
          fecha_sorteo: sorteo,
          tasa_derechos: d.tasa_derechos ?? Number(actual.tasa_derechos),
          actualizado_en: new Date(),
        },
      });
      await auditar(tx, {
        tenantId, actorId, accion: "rifa.editar", entidadTipo: "rifa", entidadId: rifaId,
        antes: { nombre: actual.nombre, precio_boleta: actual.precio_boleta.toString() },
        despues: { nombre: d.nombre, precio_boleta: d.precio_boleta },
      });
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: mensajeError(e, "Error al editar la rifa.") };
  }
}

export async function publicarRifa(tenantId: bigint, rifaId: bigint, actorId: bigint) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRawUnsafe<
          { id: bigint; estado: string; numero_min: number; numero_max: number }[]
        >(
          `SELECT id, estado, numero_min, numero_max FROM saas.rifas
            WHERE id = $1::bigint AND tenant_id = $2::bigint FOR UPDATE`,
          rifaId,
          tenantId,
        );
        const rifa = rows[0];
        if (!rifa) return { ok: false as const, error: "Rifa no encontrada." };
        if (rifa.estado !== "borrador") {
          return { ok: false as const, error: `No se puede publicar una rifa en estado '${rifa.estado}'.` };
        }

        // Materializa las boletas del rango (idempotente), con tenant_id.
        await tx.$executeRawUnsafe(
          `INSERT INTO saas.boletas (tenant_id, rifa_id, numero)
           SELECT $1::bigint, $2::bigint, g FROM generate_series($3::int, $4::int) AS g
           ON CONFLICT (rifa_id, numero) DO NOTHING`,
          tenantId,
          rifaId,
          rifa.numero_min,
          rifa.numero_max,
        );
        await tx.rifas.update({ where: { id: rifaId }, data: { estado: "activa" } });
        const boletas = await tx.boletas.count({ where: { rifa_id: rifaId } });

        await auditar(tx, {
          tenantId,
          actorId,
          accion: "rifa.publicar",
          entidadTipo: "rifa",
          entidadId: rifaId,
          antes: { estado: "borrador" },
          despues: { estado: "activa", boletas },
        });
        return { ok: true as const, boletas };
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (e) {
    return { ok: false as const, error: mensajeError(e, "Error al publicar.") };
  }
}
