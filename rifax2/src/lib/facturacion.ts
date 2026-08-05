// Facturación por empresa (registros internos, sin pasarela de pago).
// El super-admin genera facturas individuales o masivas y marca pagos.
import "server-only";
import { prisma } from "@/lib/prisma";
import { getConfigPlataforma } from "@/lib/plataforma";
import { mensajeError } from "@/lib/errores";

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export interface FacturaDB {
  id: string;
  tenantId: string;
  tenant: string;
  periodo: string;
  concepto: string;
  plan: string;
  monto: string;
  estado: string;
  emitidaEn: Date;
  venceEn: Date | null;
  pagadaEn: Date | null;
}

export async function listarFacturas(): Promise<FacturaDB[]> {
  const filas = await prisma.$queryRawUnsafe<
    { id: bigint; tenant_id: bigint; tenant: string; periodo: string; concepto: string; plan: string; monto: string; estado: string; emitida_en: Date; vence_en: Date | null; pagada_en: Date | null }[]
  >(
    `SELECT f.id, f.tenant_id, t.nombre AS tenant, f.periodo, f.concepto, f.plan, f.monto::text AS monto,
            f.estado, f.emitida_en, f.vence_en, f.pagada_en
       FROM saas.facturas f JOIN saas.tenants t ON t.id = f.tenant_id
      ORDER BY f.emitida_en DESC, f.id DESC
      LIMIT 200`,
  );
  return filas.map((f) => ({
    id: String(f.id), tenantId: String(f.tenant_id), tenant: f.tenant, periodo: f.periodo, concepto: f.concepto,
    plan: f.plan, monto: f.monto, estado: f.estado, emitidaEn: f.emitida_en, venceEn: f.vence_en, pagadaEn: f.pagada_en,
  }));
}

// Resumen de mora por tenant: total pendiente y nº de facturas vencidas.
export async function moraPorTenant(): Promise<Record<string, { pendiente: number; vencidas: number }>> {
  const filas = await prisma.$queryRawUnsafe<{ tenant_id: bigint; pendiente: string; vencidas: bigint }[]>(
    `SELECT tenant_id,
            COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'),0)::text AS pendiente,
            COUNT(*) FILTER (WHERE estado = 'pendiente' AND vence_en IS NOT NULL AND vence_en < CURRENT_DATE) AS vencidas
       FROM saas.facturas GROUP BY tenant_id`,
  );
  const m: Record<string, { pendiente: number; vencidas: number }> = {};
  for (const f of filas) m[String(f.tenant_id)] = { pendiente: Number(f.pendiente), vencidas: Number(f.vencidas) };
  return m;
}

function periodoValido(p: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

// Monto según el plan del tenant (básico = precio configurable; corporativo = a definir).
async function montoDePlan(plan: string): Promise<number> {
  if (plan === "basico") return (await getConfigPlataforma()).precioBasico;
  return 0; // corporativo: "a medida" → el super-admin ajusta el monto luego
}

export async function generarFacturaTenant(tenantId: bigint, periodo: string, montoManual?: number): Promise<Resultado> {
  if (!periodoValido(periodo)) return { ok: false, error: "Periodo inválido (usa AAAA-MM)." };
  const filas = await prisma.$queryRawUnsafe<{ plan: string }[]>(`SELECT plan FROM saas.tenants WHERE id = $1::bigint`, tenantId);
  const plan = filas[0]?.plan ?? "basico";
  const monto = montoManual != null && Number.isFinite(montoManual) ? montoManual : await montoDePlan(plan);
  // vence a 10 días de la emisión
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO saas.facturas (tenant_id, periodo, concepto, plan, monto, vence_en)
       VALUES ($1::bigint,$2::text,$3::text,$4::text,$5::numeric, (CURRENT_DATE + INTERVAL '10 days')::date)
       ON CONFLICT (tenant_id, periodo) DO NOTHING`,
      tenantId, periodo, `Suscripción ${periodo}`, plan, String(monto),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al generar la factura.") };
  }
}

// Facturación masiva: genera (si no existe) la factura del periodo para todas
// las empresas activas.
export async function generarFacturacionMasiva(periodo: string): Promise<Resultado<{ generadas: number }>> {
  if (!periodoValido(periodo)) return { ok: false, error: "Periodo inválido (usa AAAA-MM)." };
  const { precioBasico } = await getConfigPlataforma();
  const r = await prisma.$executeRawUnsafe(
    `INSERT INTO saas.facturas (tenant_id, periodo, concepto, plan, monto, vence_en)
     SELECT t.id, $1::text, $2::text, t.plan,
            CASE WHEN t.plan = 'basico' THEN $3::numeric ELSE 0 END,
            (CURRENT_DATE + INTERVAL '10 days')::date
       FROM saas.tenants t
      WHERE t.estado = 'activo'
     ON CONFLICT (tenant_id, periodo) DO NOTHING`,
    periodo, `Suscripción ${periodo}`, String(precioBasico),
  );
  return { ok: true, data: { generadas: typeof r === "number" ? r : 0 } };
}

export async function marcarFacturaPagada(facturaId: bigint): Promise<Resultado> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE saas.facturas SET estado = 'pagada', pagada_en = now() WHERE id = $1::bigint AND estado <> 'anulada'`,
      facturaId,
    );
    // Al recibir el pago se extiende la vigencia del tenant según su periodicidad
    // de pago (esto también suspende el aviso de vencimiento).
    await tx.$executeRawUnsafe(
      `UPDATE saas.tenants t SET fecha_vencimiento = (
           GREATEST(COALESCE(t.fecha_vencimiento, CURRENT_DATE), CURRENT_DATE)
           + (CASE t.periodicidad_pago WHEN 'anual' THEN '1 year' WHEN 'semestral' THEN '6 months' ELSE '1 month' END)::interval
         )::date
         FROM saas.facturas f
        WHERE f.id = $1::bigint AND t.id = f.tenant_id`,
      facturaId,
    );
  });
  return { ok: true };
}

export async function anularFactura(facturaId: bigint): Promise<Resultado> {
  await prisma.$executeRawUnsafe(`UPDATE saas.facturas SET estado = 'anulada' WHERE id = $1::bigint`, facturaId);
  return { ok: true };
}
