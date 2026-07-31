"use client";

import { useActionState } from "react";
import { importarVendedoresAction, importarVentasAction, type ImportState } from "./actions";

const initial: ImportState = {};

function Resultado({ state }: { state: ImportState }) {
  if (state.error) return <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>;
  if (!state.resultado) return null;
  const r = state.resultado;
  return (
    <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
      <p className="font-medium text-slate-800 dark:text-slate-200">
        Procesadas {r.total} · <span className="text-emerald-600 dark:text-emerald-400">{r.ok} importadas</span>
        {r.omitidos > 0 ? <> · <span className="text-slate-500">{r.omitidos} ya existían</span></> : null}
        {r.errores.length > 0 ? <> · <span className="text-red-600 dark:text-red-400">{r.errores.length} con error</span></> : null}
      </p>
      {r.errores.length > 0 ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-700 dark:text-red-400">
          {r.errores.map((e, i) => <li key={i}>Fila {e.fila}: {e.detalle}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

const fileCls = "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 dark:text-slate-300";

export default function ImportForms({ rifaId }: { rifaId: string }) {
  const [sVend, aVend, pVend] = useActionState(importarVendedoresAction, initial);
  const [sVent, aVent, pVent] = useActionState(importarVentasAction, initial);

  return (
    <div className="mt-6 space-y-6">
      {/* Paso 1: Vendedores */}
      <form action={aVend} className="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">1. Importar vendedores</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sube <code>plantilla_vendedores.csv</code>. Los documentos ya existentes se omiten.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input name="archivo" type="file" accept=".csv,text/csv" required className={fileCls} />
          <button type="submit" disabled={pVend} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{pVend ? "Importando…" : "Importar vendedores"}</button>
        </div>
        <Resultado state={sVend} />
      </form>

      {/* Paso 2: Ventas */}
      <form action={aVent} className="rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <input type="hidden" name="rifa_id" value={rifaId} />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">2. Importar ventas realizadas</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sube <code>plantilla_ventas.csv</code>. Crea clientes, reserva las boletas vendidas y registra lo abonado.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input name="archivo" type="file" accept=".csv,text/csv" required className={fileCls} />
          <button type="submit" disabled={pVent} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{pVent ? "Importando…" : "Importar ventas"}</button>
        </div>
        <Resultado state={sVent} />
      </form>
    </div>
  );
}
