import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { obtenerLandingTenant } from "@/lib/landing";
import { brandCss } from "@/lib/color";
import { money, fecha } from "@/lib/format";
import Carrusel from "@/app/carrusel";
import type { Slide } from "@/lib/landing-slides";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const datos = await obtenerLandingTenant(slug);
  if (!datos) return { title: "RIFAX" };
  return { title: `${datos.tenant.nombre} · Rifas en línea` };
}

// Misma presentación que la landing de la plataforma (src/app/page.tsx):
// header fijo con desenfoque, carrusel a pantalla completa, hero centrado
// con botones, y pie de página — pero mostrando las rifas de ESTA empresa
// (nombre de la rifa donde la landing general muestra su mensaje genérico).
export default async function LandingEmpresa({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const datos = await obtenerLandingTenant(slug);
  if (!datos) notFound();
  const { tenant, rifas } = datos;

  const slides: Slide[] = rifas.length > 0
    ? rifas.map((r) => ({
        imagen: r.boletaImagenUrl ?? undefined,
        gradiente: "bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#0f172a]",
        titulo: r.nombre,
        subtitulo: r.premioPrincipal ? `🏆 ${r.premioPrincipal} · ${money(r.precioBoleta)} la boleta` : `${money(r.precioBoleta)} la boleta · sorteo ${fecha(r.fechaSorteo)}`,
      }))
    : [{ gradiente: "bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#0f172a]", titulo: tenant.nombre, subtitulo: "Vuelve pronto: aún no hay rifas activas." }];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <style nonce={nonce}>{brandCss(tenant.colorPrimario)}</style>

      {/* NAV */}
      <header className="sticky top-0 z-20 border-b border-slate-300/70 bg-white/80 backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            {tenant.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={tenant.logoUrl} alt={tenant.nombre} className="h-9 w-9 rounded-xl object-contain shadow-lg shadow-slate-900/10" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--rifax-accent,#f5c518)] text-lg font-black text-slate-900 shadow-lg shadow-slate-900/25">
                {tenant.nombre.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-lg font-black tracking-tight">{tenant.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/consulta" className="hidden rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-block dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              Consultar boleta
            </Link>
            {rifas.length > 0 ? (
              <a href="#rifas" className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:opacity-90">
                Comprar boletas
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* CARRUSEL: una rifa por slide, con su nombre como título */}
      <Carrusel slides={slides} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[var(--rifax-accent,#f5c518)]/20 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--rifax-accent,#f5c518)]" /> Rifas en línea
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Juega con <span style={{ color: "var(--rifax-accent, #eab308)" }}>{tenant.nombre}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Elige tus números y paga en línea de forma segura. Consulta el estado de tu compra cuando quieras.
          </p>
          {rifas.length > 0 ? (
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#rifas" className="w-full rounded-lg bg-[var(--rifax-accent,#f5c518)] px-6 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition hover:opacity-90 sm:w-auto">
                Ver rifas y comprar →
              </a>
              <Link href="/consulta" className="w-full rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                Consultar mi cuenta
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* RIFAS ACTIVAS */}
      {rifas.length > 0 ? (
        <section id="rifas" className="border-t border-slate-200 bg-white py-16 dark:border-slate-900 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Rifas activas</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">Elige la tuya y separa tus números.</p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rifas.map((r) => (
                <div
                  key={r.id}
                  className="group overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm transition hover:border-[var(--rifax-accent,#f5c518)] hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="h-36 bg-slate-800 bg-cover bg-center" style={r.boletaImagenUrl ? { backgroundImage: `url(${r.boletaImagenUrl})` } : undefined} />
                  <div className="p-5">
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{r.codigo}</p>
                    <h3 className="mt-0.5 text-base font-semibold">{r.nombre}</h3>
                    {r.premioPrincipal ? <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">🏆 {r.premioPrincipal}</p> : null}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sorteo {fecha(r.fechaSorteo)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold">{money(r.precioBoleta)}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{r.disponibles.toLocaleString("es-CO")} de {r.totalBoletas.toLocaleString("es-CO")} disponibles</span>
                    </div>
                    <Link
                      href={`/e/${tenant.slug}/comprar/${r.id}`}
                      className="mt-4 block rounded-lg bg-[var(--rifax-accent,#f5c518)] px-4 py-2.5 text-center text-sm font-bold text-slate-900 transition hover:opacity-90"
                    >
                      Comprar boletas
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <p className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          {tenant.nombre} no tiene rifas activas por ahora. Vuelve pronto.
        </p>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-300 py-10 dark:border-slate-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row dark:text-slate-400">
          <div className="flex items-center gap-2">
            {tenant.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={tenant.logoUrl} alt={tenant.nombre} className="h-6 w-6 rounded-md object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--rifax-accent,#f5c518)] text-xs font-black text-slate-900">{tenant.nombre.charAt(0).toUpperCase()}</div>
            )}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{tenant.nombre}</span>
          </div>
          <p>© {new Date().getFullYear()} {tenant.nombre}. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/consulta" className="hover:text-slate-700 hover:underline dark:hover:text-slate-200">Consultar boleta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
