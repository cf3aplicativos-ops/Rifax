import { requirePermission } from "@/lib/auth/rbac";
import { listarCatalogos, TIPOS } from "@/lib/catalogos";
import { agregarItemAction, toggleItemAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePermission("config.gestionar");
  const sp = await searchParams;
  const porTipo = await listarCatalogos(user.tenant.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Personaliza las listas desplegables del aplicativo. Si no agregas opciones, se usan las
        predeterminadas.
      </p>

      {sp.ok ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Guardado.</p> : null}
      {sp.error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p> : null}

      <div className="mt-6 space-y-6">
        {TIPOS.map((t) => {
          const items = porTipo.get(t.tipo) ?? [];
          const usaDefaults = items.length === 0;
          return (
            <section key={t.tipo} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.titulo}</h2>

              <div className="mt-3 space-y-1.5">
                {usaDefaults ? (
                  t.defaults.map((d) => (
                    <div key={d.valor} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/50">
                      <span className="text-slate-700 dark:text-slate-300">{d.etiqueta} <span className="font-mono text-xs text-slate-400">({d.valor})</span></span>
                      <span className="text-xs text-slate-400">predeterminado</span>
                    </div>
                  ))
                ) : (
                  items.map((it) => (
                    <div key={String(it.id)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/50">
                      <span className={it.activo ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through"}>
                        {it.etiqueta} <span className="font-mono text-xs text-slate-400">({it.valor})</span>
                      </span>
                      <form action={toggleItemAction}>
                        <input type="hidden" name="id" value={String(it.id)} />
                        <button type="submit" className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                          {it.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>

              <form action={agregarItemAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <input type="hidden" name="tipo" value={t.tipo} />
                <input name="etiqueta" required placeholder="Etiqueta (visible)" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <input name="valor" required placeholder="valor_interno" className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Agregar</button>
              </form>
              {usaDefaults ? <p className="mt-2 text-xs text-slate-400">Al agregar la primera opción, esta lista deja de usar los predeterminados.</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
