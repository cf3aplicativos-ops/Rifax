import Link from "next/link";
import Image from "next/image";
import { PageTitle } from "@/components/icons";
import { requireSuper } from "@/lib/auth/rbac";
import { listarSlides } from "@/lib/plataforma";
import { crearSlideAction, eliminarSlideAction, toggleSlideAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CarruselPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; eliminado?: string; estado?: string; error?: string }>;
}) {
  await requireSuper();
  const sp = await searchParams;
  const slides = await listarSlides();

  return (
    <div>
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a empresas</Link>
      <PageTitle icon="empresas" className="mt-2">Carrusel de la landing</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sube las fotos y textos que rotan en la parte superior de la página pública.</p>

      {sp.creado ? <Aviso tipo="ok">Slide agregado.</Aviso> : null}
      {sp.eliminado ? <Aviso tipo="ok">Slide eliminado.</Aviso> : null}
      {sp.estado ? <Aviso tipo="ok">Visibilidad actualizada.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {/* Alta de slide con imagen */}
      <form action={crearSlideAction} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nueva foto del carrusel</h2>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Imagen (PNG, JPG, WEBP o SVG · máx. 2 MB)</label>
          <input name="imagen" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 dark:text-slate-300" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Título (opcional)</label>
            <input name="titulo" className={ctrl} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Subtítulo (opcional)</label>
            <input name="subtitulo" className={ctrl} />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Orden</label>
            <input name="orden" type="number" defaultValue={slides.length} className={`${ctrl} w-24`} />
          </div>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Agregar al carrusel</button>
        </div>
      </form>

      {/* Slides existentes */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Slides ({slides.length})</h2>
        {slides.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Aún no hay fotos. Mientras no agregues ninguna, la landing muestra el carrusel por defecto.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slides.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="relative h-32 w-full bg-slate-100 dark:bg-slate-800">
                  {s.imagen_url ? (
                    <Image src={s.imagen_url} alt={s.titulo ?? "slide"} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-slate-400">sin imagen</div>
                  )}
                  {!s.activo ? <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">oculto</span> : null}
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.titulo ?? <span className="text-slate-400">(sin título)</span>}</p>
                  {s.subtitulo ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.subtitulo}</p> : null}
                  <p className="mt-1 text-[11px] text-slate-400">orden {s.orden}</p>
                  <div className="mt-3 flex gap-2">
                    <form action={toggleSlideAction}><input type="hidden" name="id" value={s.id} /><button className={btnSec}>{s.activo ? "Ocultar" : "Mostrar"}</button></form>
                    <form action={eliminarSlideAction}><input type="hidden" name="id" value={s.id} /><button className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Eliminar</button></form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const ctrl = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const btnSec = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
