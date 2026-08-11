"use client";

import { useState } from "react";
import { purgarTenantAction } from "./actions";

// Declarado fuera del componente: si se define dentro de BorrarWizard, React
// lo trata como un tipo de componente distinto en cada render (pierde estado
// e impide la reconciliación normal).
function Punto({ n, paso }: { n: number; paso: number }) {
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${paso >= n ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"}`}>{n}</span>
  );
}

// Borrado de la base de datos de un cliente con verificación en TRES pasos.
export default function BorrarWizard({ tenantId, slug, nombre }: { tenantId: string; slug: string; nombre: string }) {
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState(1);
  const [acepta, setAcepta] = useState(false);
  const [slugTxt, setSlugTxt] = useState("");
  const [frase, setFrase] = useState("");

  const cerrar = () => { setOpen(false); setPaso(1); setAcepta(false); setSlugTxt(""); setFrase(""); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ml-auto rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
        Eliminar base de datos
      </button>
    );
  }

  return (
    <form action={purgarTenantAction} className="ml-auto w-full rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="slug" value={slug} />
      {/* Los valores verificados viajan como hidden; el servidor los revalida. */}
      <input type="hidden" name="acepta" value={acepta ? "on" : ""} />
      <input type="hidden" name="confirm_slug" value={slugTxt} />
      <input type="hidden" name="confirm_frase" value={frase} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Punto n={1} paso={paso} /><span className="h-px w-4 bg-red-300" /><Punto n={2} paso={paso} /><span className="h-px w-4 bg-red-300" /><Punto n={3} paso={paso} />
        </div>
        <button type="button" onClick={cerrar} className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">Cancelar</button>
      </div>

      <p className="mb-3 text-sm font-semibold text-red-800 dark:text-red-300">Eliminar base de datos de «{nombre}»</p>

      {paso === 1 ? (
        <div>
          <label className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
            Entiendo que esto borra <strong>todos los datos</strong> de la empresa (sedes, rifas, ventas, cartera, usuarios…) de forma <strong>irreversible</strong>.
          </label>
          <button type="button" disabled={!acepta} onClick={() => setPaso(2)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
            Continuar (paso 1 de 3)
          </button>
        </div>
      ) : null}

      {paso === 2 ? (
        <div>
          <label htmlFor="borrar-confirm-slug" className="mb-1 block text-xs text-red-700 dark:text-red-300">
            Escribe el identificador <span className="font-mono font-bold">{slug}</span> para confirmar la empresa:
          </label>
          <input id="borrar-confirm-slug" value={slugTxt} onChange={(e) => setSlugTxt(e.target.value)} placeholder={slug} autoFocus className="w-56 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-sm dark:border-red-900 dark:bg-slate-950 dark:text-slate-100" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPaso(1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">Atrás</button>
            <button type="button" disabled={slugTxt !== slug} onClick={() => setPaso(3)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
              Continuar (paso 2 de 3)
            </button>
          </div>
        </div>
      ) : null}

      {paso === 3 ? (
        <div>
          <label htmlFor="borrar-confirm-frase" className="mb-1 block text-xs text-red-700 dark:text-red-300">
            Último paso: escribe <span className="font-mono font-bold">ELIMINAR</span> para borrar definitivamente:
          </label>
          <input id="borrar-confirm-frase" value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="ELIMINAR" autoFocus className="w-56 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-sm dark:border-red-900 dark:bg-slate-950 dark:text-slate-100" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPaso(2)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">Atrás</button>
            <button type="submit" disabled={frase.trim().toUpperCase() !== "ELIMINAR"} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
              Borrar todo definitivamente
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
