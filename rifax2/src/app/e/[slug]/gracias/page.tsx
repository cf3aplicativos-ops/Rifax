import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { brandCss } from "@/lib/color";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

// El estado real del pago lo confirma el webhook de Wompi (nunca este
// redirect del navegador, que el cliente podría manipular). Esta pantalla
// solo informa; si el webhook aún no llegó, muestra "procesando".
export default async function GraciasPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ venta?: string }> }) {
  const { slug } = await params;
  const { venta: ventaIdStr } = await searchParams;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const tenant = await prisma.tenants.findFirst({ where: { slug, estado: "activo" }, select: { id: true, nombre: true } });
  const config = tenant ? await prisma.tenant_config.findUnique({ where: { tenant_id: tenant.id } }) : null;

  let venta: { codigo: string; estado: string; total: string } | null = null;
  if (tenant && ventaIdStr) {
    try {
      const v = await prisma.ventas.findFirst({ where: { id: BigInt(ventaIdStr), tenant_id: tenant.id }, select: { codigo: true, estado: true, total: true } });
      if (v) venta = { codigo: v.codigo, estado: v.estado, total: v.total.toString() };
    } catch {
      // id inválido: se ignora, se muestra el mensaje genérico
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style nonce={nonce}>{brandCss(config?.color_primario ?? "#f5c518")}</style>
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        {venta?.estado === "pagada" ? (
          <>
            <p className="text-5xl">🎉</p>
            <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">¡Pago confirmado!</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Tu compra <span className="font-mono">{venta.codigo}</span> por {money(venta.total)} quedó registrada. Guarda tu número de teléfono a mano: lo necesitarás para consultar tu boleta.
            </p>
          </>
        ) : venta ? (
          <>
            <p className="text-5xl">⏳</p>
            <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Estamos confirmando tu pago</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Tu compra <span className="font-mono">{venta.codigo}</span> quedó reservada. Puede tardar unos minutos en confirmarse; consulta tu estado de cuenta más tarde con tu documento y teléfono.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gracias por tu compra</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Consulta el estado de tu cuenta con tu documento y teléfono.</p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/consulta" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Consultar mi cuenta</Link>
          {tenant ? <Link href={`/e/${slug}`} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Volver a {tenant.nombre}</Link> : null}
        </div>
      </main>
    </div>
  );
}
