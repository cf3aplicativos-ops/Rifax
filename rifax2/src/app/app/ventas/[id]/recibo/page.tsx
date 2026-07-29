import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { money, fechaHora } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("venta.ver");
  const { id } = await params;
  let ventaId: bigint;
  try { ventaId = BigInt(id); } catch { notFound(); }

  const [venta, branding] = await Promise.all([
    prisma.ventas.findFirst({
      where: { id: ventaId, tenant_id: user.tenant.id },
      include: {
        clientes: { select: { nombre: true, telefono: true } },
        rifas: { select: { codigo: true, nombre: true } },
        sedes: { select: { nombre: true, direccion: true, telefono: true } },
        tenants: { select: { nombre: true } },
        abonos: { orderBy: { id: "asc" }, include: { usuarios: { select: { nombre: true } } } },
      },
    }),
    getBranding(user.tenant.id),
  ]);
  if (!venta) notFound();

  const abonado = Number(venta.total.toString()) - Number(venta.saldo.toString());

  return (
    <div>
      {/* En impresión se oculta el header de la app y los controles */}
      <style>{"@media print{header{display:none!important}.no-print{display:none!important}body{background:#fff!important}}"}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/app/ventas/${venta.id}`} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a la venta</Link>
        <PrintButton />
      </div>

      {/* Recibo (ancho tipo ticket 80mm) */}
      <div className="mx-auto max-w-[320px] rounded-lg border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700">
        <div className="text-center">
          {branding.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={branding.logoUrl} alt="logo" className="mx-auto mb-2 h-12 w-12 object-contain" />
          ) : null}
          <p className="text-base font-bold">{venta.tenants.nombre}</p>
          <p className="text-xs text-slate-600">{venta.sedes.nombre}</p>
          {venta.sedes.direccion ? <p className="text-[11px] text-slate-500">{venta.sedes.direccion}</p> : null}
          {venta.sedes.telefono ? <p className="text-[11px] text-slate-500">Tel: {venta.sedes.telefono}</p> : null}
        </div>

        <div className="my-3 border-t border-dashed border-slate-300" />
        <p className="text-center text-sm font-bold tracking-wide">RECIBO DE CAJA</p>
        <p className="text-center font-mono text-xs text-slate-600">{venta.codigo}</p>

        <div className="my-3 border-t border-dashed border-slate-300" />
        <dl className="space-y-1 text-xs">
          <Row k="Fecha" v={fechaHora(new Date())} />
          <Row k="Cliente" v={venta.clientes.nombre} />
          <Row k="Teléfono" v={venta.clientes.telefono} />
          <Row k="Rifa" v={`${venta.rifas.codigo}`} />
          <Row k="Cajero" v={user.nombre} />
        </dl>

        <div className="my-3 border-t border-dashed border-slate-300" />
        <p className="text-xs font-semibold">Pagos registrados</p>
        <table className="mt-1 w-full text-[11px]">
          <tbody>
            {venta.abonos.length === 0 ? (
              <tr><td className="py-0.5 text-slate-500">Sin pagos registrados.</td></tr>
            ) : (
              venta.abonos.map((a) => (
                <tr key={String(a.id)}>
                  <td className="py-0.5 text-slate-600">{fechaHora(a.registrado_en)}</td>
                  <td className="py-0.5 text-right font-medium">{money(a.monto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-slate-300" />
        <dl className="space-y-1 text-xs">
          <Row k="Total venta" v={money(venta.total)} bold />
          <Row k="Abonado" v={money(abonado)} bold />
          <Row k="Saldo" v={money(venta.saldo)} bold />
        </dl>

        <div className="my-3 border-t border-dashed border-slate-300" />
        <p className="text-center text-[10px] text-slate-500">¡Gracias por su compra! · Conserve este recibo.</p>
        <p className="text-center text-[10px] text-slate-400">RIFAX</p>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className={bold ? "font-bold" : "font-medium"}>{v}</dd>
    </div>
  );
}
