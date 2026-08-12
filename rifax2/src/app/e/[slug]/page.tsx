import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { obtenerLandingTenant } from "@/lib/landing";
import { brandCss } from "@/lib/color";
import { money, fecha } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const datos = await obtenerLandingTenant(slug);
  if (!datos) return { title: "RIFAX" };
  return { title: `${datos.tenant.nombre} · Rifas en línea` };
}

export default async function LandingEmpresa({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await obtenerLandingTenant(slug);
  if (!datos) notFound();
  const { tenant, rifas } = datos;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{brandCss(tenant.colorPrimario)}</style>

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          {tenant.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={tenant.logoUrl} alt={tenant.nombre} className="h-12 w-12 rounded-lg object-contain" />
          ) : null}
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{tenant.nombre}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rifas activas</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Elige tus números y paga en línea de forma segura.</p>

        {rifas.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {tenant.nombre} no tiene rifas activas por ahora. Vuelve pronto.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rifas.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div
                  className="h-32 bg-slate-800 bg-cover bg-center"
                  style={r.boletaImagenUrl ? { backgroundImage: `url(${r.boletaImagenUrl})` } : undefined}
                />
                <div className="p-4">
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{r.codigo}</p>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{r.nombre}</h3>
                  {r.premioPrincipal ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">🏆 {r.premioPrincipal}</p> : null}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sorteo {fecha(r.fechaSorteo)}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{money(r.precioBoleta)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{r.disponibles.toLocaleString("es-CO")} de {r.totalBoletas.toLocaleString("es-CO")} disponibles</span>
                  </div>
                  <Link
                    href={`/e/${tenant.slug}/comprar/${r.id}`}
                    className="mt-3 block rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Comprar boletas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          ¿Ya compraste? <Link href="/consulta" className="underline">Consulta el estado de tu cuenta</Link>.
        </p>
      </main>
    </div>
  );
}
