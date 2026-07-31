import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { obtenerRifa } from "@/lib/rifas";
import { PageTitle } from "@/components/icons";
import ImportForms from "./forms";

export const dynamic = "force-dynamic";

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("venta.crear");
  const { id } = await params;
  let rifaId: bigint;
  try { rifaId = BigInt(id); } catch { notFound(); }
  const rifa = await obtenerRifa(user.tenant.id, rifaId);
  if (!rifa) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/app/rifas/${rifa.id}`} className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a la rifa</Link>
      <PageTitle icon="rifas" className="mt-2">Carga masiva · {rifa.codigo}</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Continúa en el aplicativo una rifa ya en curso importando sus vendedores y ventas.
      </p>

      {rifa.estado === "borrador" ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Publica la rifa antes de importar ventas (las boletas se materializan al publicar).
        </p>
      ) : null}

      {/* Descargas: plantillas y guía */}
      <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Plantillas y guía</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Descarga los archivos, llénalos con los datos de tu rifa e impórtalos abajo.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/plantillas?t=vendedores" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">⬇ plantilla_vendedores.csv</a>
          <a href="/api/plantillas?t=ventas" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">⬇ plantilla_ventas.csv</a>
          <a href="/api/plantillas?t=guia" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">⬇ guía (.txt)</a>
        </div>
      </div>

      <ImportForms rifaId={String(rifa.id)} />
    </div>
  );
}
