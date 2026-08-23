import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { imagenesRifa } from "@/lib/rifas";
import { ventaEnAlcanceParaRecibo } from "@/lib/ventas";
import { money, fechaHora } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("venta.ver");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
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
        ventas_boletas: { include: { boletas: { select: { numero: true } } } },
      },
    }),
    getBranding(user.tenant.id),
  ]);
  if (!venta) notFound();
  // Un vendedor solo ve sus ventas; un usuario de sede, solo las de su sede.
  if (!(await ventaEnAlcanceParaRecibo(user, ventaId))) notFound();
  // Logo e imagen de boleta propios de la rifa; si no tiene logo, se usa el de la empresa.
  const imagenes = await imagenesRifa(user.tenant.id, venta.rifa_id);
  const rifaLogo = imagenes.logo ?? branding.logoUrl;
  const boletas = venta.ventas_boletas.map((vb) => vb.boletas.numero).sort((a, b) => a - b);

  const abonado = Number(venta.total.toString()) - Number(venta.saldo.toString());

  return (
    <div>
      {/* En impresión se oculta el header de la app y los controles */}
      <style nonce={nonce}>
        {"@media print{header{display:none!important}.no-print{display:none!important}body{background:#fff!important}}" +
          ".rifax-boleta-pill{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}"}
      </style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/app/ventas/${venta.id}`} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a la venta</Link>
        <PrintButton />
      </div>

      {/* Recibo (ancho tipo ticket 80mm) */}
      <div className="mx-auto max-w-[320px] rounded-lg border border-slate-300 bg-white p-5 text-slate-900 dark:border-slate-700">
        <div className="text-center">
          {rifaLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={rifaLogo} alt="logo" className="mx-auto mb-2 h-14 w-14 object-contain" />
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
        <p className="text-xs font-semibold">Boletas ({boletas.length})</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {boletas.map((n) => (
            <span
              key={n}
              className="rifax-boleta-pill relative inline-flex h-8 min-w-[44px] items-center justify-center overflow-hidden rounded bg-[#1e293b] bg-cover bg-center px-1.5"
              style={imagenes.boleta ? { backgroundImage: `url(${imagenes.boleta})` } : undefined}
            >
              {imagenes.boleta ? <span className="absolute inset-0 bg-black/45" /> : null}
              <span className="relative font-mono text-xs font-bold tracking-wide text-[#f5c518]">{n}</span>
            </span>
          ))}
        </div>

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
