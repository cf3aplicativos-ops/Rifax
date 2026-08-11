// Calendario de fechas de vencimiento por empresa. El número de fechas depende
// de la periodicidad del plan: mensual=12, semestral=2, anual=1. Al recibir el
// pago de una fecha se marca con paloma y su aviso deja de mostrarse; el aviso
// pasa a la siguiente fecha pendiente.
import "server-only";
import { prisma } from "@/lib/prisma";

type Resultado = { ok: true } | { ok: false; error: string };

export function cantidadFechas(periodicidad: string): number {
  return periodicidad === "mensual" ? 12 : periodicidad === "semestral" ? 2 : 1;
}
function intervalo(periodicidad: string): string {
  return periodicidad === "mensual" ? "1 month" : periodicidad === "semestral" ? "6 months" : "1 year";
}

export interface Vencimiento { id: string; numero: number; fecha: string; estado: string; pagadaEn: Date | null }

// (Re)genera el calendario para un tenant a partir de una fecha de inicio.
// Debe correr dentro de una transacción propia o compartida (tx).
export async function generarVencimientos(
  tx: typeof prisma,
  tenantId: bigint,
  fechaInicioISO: string | null,
  periodicidad: string,
): Promise<void> {
  const n = cantidadFechas(periodicidad);
  const paso = intervalo(periodicidad);
  // Solo se borran las cuotas PENDIENTES: las ya pagadas son historial de cobro
  // (llevan `pagada_en`) y el DELETE indiscriminado anterior las perdía cada vez
  // que el super-admin editaba la periodicidad o la fecha de inicio.
  await tx.$executeRawUnsafe(`DELETE FROM saas.vencimientos WHERE tenant_id = $1::bigint AND estado = 'pendiente'`, tenantId);
  await tx.$executeRawUnsafe(
    `INSERT INTO saas.vencimientos (tenant_id, numero, fecha)
     SELECT $1::bigint, gs, (COALESCE($2::date, CURRENT_DATE) + (gs * $3::interval))::date
       FROM generate_series(1, $4::int) AS gs
     ON CONFLICT (tenant_id, numero) DO NOTHING`,
    tenantId,
    fechaInicioISO && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicioISO) ? fechaInicioISO : null,
    paso,
    n,
  );
  // Mantiene fecha_vencimiento (siguiente pendiente) sincronizada.
  await tx.$executeRawUnsafe(
    `UPDATE saas.tenants t SET fecha_vencimiento = (
        SELECT MIN(fecha) FROM saas.vencimientos v WHERE v.tenant_id = t.id AND v.estado = 'pendiente'
      ) WHERE t.id = $1::bigint`,
    tenantId,
  );
}

export async function regenerarVencimientos(tenantId: bigint): Promise<Resultado> {
  const filas = await prisma.$queryRawUnsafe<{ fecha_inicio: string | null; periodicidad: string }[]>(
    `SELECT to_char(fecha_inicio,'YYYY-MM-DD') AS fecha_inicio, periodicidad FROM saas.tenants WHERE id = $1::bigint`,
    tenantId,
  );
  const t = filas[0];
  if (!t) return { ok: false, error: "Empresa no encontrada." };
  await prisma.$transaction((tx) => generarVencimientos(tx as typeof prisma, tenantId, t.fecha_inicio, t.periodicidad));
  return { ok: true };
}

export async function listarVencimientos(tenantId: bigint): Promise<Vencimiento[]> {
  const filas = await prisma.$queryRawUnsafe<{ id: bigint; numero: number; fecha: string; estado: string; pagada_en: Date | null }[]>(
    `SELECT id, numero, to_char(fecha,'DD/MM/YYYY') AS fecha, estado, pagada_en
       FROM saas.vencimientos WHERE tenant_id = $1::bigint ORDER BY numero ASC`,
    tenantId,
  );
  return filas.map((f) => ({ id: String(f.id), numero: f.numero, fecha: f.fecha, estado: f.estado, pagadaEn: f.pagada_en }));
}

// Marca una fecha como pagada (paloma) y actualiza la próxima fecha pendiente.
export async function registrarPagoVencimiento(vencimientoId: bigint): Promise<Resultado> {
  await prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRawUnsafe<{ tenant_id: bigint }[]>(
      `UPDATE saas.vencimientos SET estado = 'pagada', pagada_en = now()
        WHERE id = $1::bigint AND estado = 'pendiente' RETURNING tenant_id`,
      vencimientoId,
    );
    const tid = filas[0]?.tenant_id;
    if (tid) {
      await tx.$executeRawUnsafe(
        `UPDATE saas.tenants t SET fecha_vencimiento = (
            SELECT MIN(fecha) FROM saas.vencimientos v WHERE v.tenant_id = t.id AND v.estado = 'pendiente'
          ) WHERE t.id = $1::bigint`,
        tid,
      );
    }
  });
  return { ok: true };
}

// Todos los vencimientos agrupados por tenant (para el panel).
export async function vencimientosPorTenant(): Promise<Record<string, Vencimiento[]>> {
  const filas = await prisma.$queryRawUnsafe<{ tenant_id: bigint; id: bigint; numero: number; fecha: string; estado: string; pagada_en: Date | null }[]>(
    `SELECT tenant_id, id, numero, to_char(fecha,'DD/MM/YYYY') AS fecha, estado, pagada_en
       FROM saas.vencimientos ORDER BY tenant_id, numero ASC`,
  );
  const m: Record<string, Vencimiento[]> = {};
  for (const f of filas) {
    const k = String(f.tenant_id);
    (m[k] ??= []).push({ id: String(f.id), numero: f.numero, fecha: f.fecha, estado: f.estado, pagadaEn: f.pagada_en });
  }
  return m;
}

export interface VencimientoCritico { tenantId: string; nombre: string; fecha: string; dias: number }

// Empresas cuya próxima fecha pendiente vence dentro de `diasMax` días (o ya
// venció), para el aviso emergente del super-admin (#2, "cinco días de
// anticipación calculados desde la fecha de inicio del contrato").
export async function proximosVencimientosCriticos(diasMax: number): Promise<VencimientoCritico[]> {
  const filas = await prisma.$queryRawUnsafe<{ tenant_id: bigint; nombre: string; fecha: string; dias: number }[]>(
    // El recorte por `diasMax` va en SQL: filtrarlo en JS obligaba a traer la
    // próxima cuota de TODAS las empresas en cada carga del panel.
    `SELECT * FROM (
       SELECT DISTINCT ON (v.tenant_id) v.tenant_id, t.nombre,
              to_char(v.fecha,'DD/MM/YYYY') AS fecha, (v.fecha - CURRENT_DATE)::int AS dias
         FROM saas.vencimientos v JOIN saas.tenants t ON t.id = v.tenant_id
        WHERE v.estado = 'pendiente'
        ORDER BY v.tenant_id, v.fecha ASC
     ) p
      WHERE p.dias <= $1::int
      ORDER BY p.dias ASC`,
    diasMax,
  );
  return filas.map((f) => ({ tenantId: String(f.tenant_id), nombre: f.nombre, fecha: f.fecha, dias: Number(f.dias) }));
}

// Próxima fecha pendiente por tenant (para el resumen del panel).
export async function proximosVencimientos(): Promise<Record<string, { fecha: string; dias: number }>> {
  const filas = await prisma.$queryRawUnsafe<{ tenant_id: bigint; fecha: string; dias: number }[]>(
    // `v.fecha` cualificado a propósito: sin el prefijo, el identificador simple
    // del ORDER BY resuelve contra el alias de salida `fecha`, que es el texto
    // 'DD/MM/YYYY'. Ordenar por ese texto compara día-mes-año como cadena, así
    // que el DISTINCT ON se quedaba con una fecha que no era la más próxima
    // (p. ej. elegía 01/12/2026 teniendo pendiente el 15/11/2026).
    `SELECT DISTINCT ON (v.tenant_id) v.tenant_id, to_char(v.fecha,'DD/MM/YYYY') AS fecha,
            (v.fecha - CURRENT_DATE)::int AS dias
       FROM saas.vencimientos v WHERE v.estado = 'pendiente'
      ORDER BY v.tenant_id, v.fecha ASC`,
  );
  const m: Record<string, { fecha: string; dias: number }> = {};
  for (const f of filas) m[String(f.tenant_id)] = { fecha: f.fecha, dias: Number(f.dias) };
  return m;
}
