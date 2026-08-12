import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boletasDisponibles } from "@/lib/ventas";
import { brandCss } from "@/lib/color";
import { money, fecha } from "@/lib/format";
import FormCompra from "./form";

export const dynamic = "force-dynamic";

export default async function ComprarPage({ params }: { params: Promise<{ slug: string; rifaId: string }> }) {
  const { slug, rifaId: rifaIdStr } = await params;
  let rifaId: bigint;
  try { rifaId = BigInt(rifaIdStr); } catch { notFound(); }

  const tenant = await prisma.tenants.findFirst({ where: { slug, estado: "activo" }, select: { id: true, nombre: true } });
  if (!tenant) notFound();
  const [config, rifa] = await Promise.all([
    prisma.tenant_config.findUnique({ where: { tenant_id: tenant.id } }),
    prisma.$queryRawUnsafe<{ id: bigint; codigo: string; nombre: string; precio_boleta: string; boleta_url: string | null; fecha_sorteo: Date }[]>(
      `SELECT id, codigo, nombre, precio_boleta::text AS precio_boleta, boleta_url, fecha_sorteo
         FROM saas.rifas WHERE id = $1::bigint AND tenant_id = $2::bigint AND estado = 'activa'`,
      rifaId, tenant.id,
    ),
  ]);
  const r = rifa[0];
  if (!r) notFound();

  const disponibles = await boletasDisponibles(tenant.id, rifaId, 300, null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{brandCss(config?.color_primario ?? "#f5c518")}</style>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link href={`/e/${slug}`} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← {tenant.nombre}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{r.codigo}</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{r.nombre}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sorteo {fecha(r.fecha_sorteo)} · {money(r.precio_boleta)} por boleta</p>

        <FormCompra
          slug={slug}
          rifaId={String(r.id)}
          precioBoleta={r.precio_boleta}
          boletaImagenUrl={r.boleta_url}
          disponibles={disponibles}
        />
      </main>
    </div>
  );
}
