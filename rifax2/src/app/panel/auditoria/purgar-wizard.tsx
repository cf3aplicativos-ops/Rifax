"use client";

import { useState } from "react";
import { purgarAuditoriaAction } from "./actions";

function Punto({ n, paso }: { n: number; paso: number }) {
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${paso >= n ? "bg-red-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"}`}>{n}</span>
  );
}

// Purga del historial de auditoría con verificación en DOS pasos (fecha +
// aceptación explícita, luego la palabra PURGAR) — un paso menos que borrar
// un tenant entero, porque aquí no hay un identificador único que escribir.
export default function PurgarWizard({ limiteMaximo }: { limiteMaximo: string }) {
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState(1);
  const [hasta, setHasta] = useState(limiteMaximo);
  const [acepta, setAcepta] = useState(false);
  const [frase, setFrase] = useState("");

  const cerrar = () => { setOpen(false); setPaso(1); setAcepta(false); setFrase(""); setHasta(limiteMaximo); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
        Purgar historial antiguo
      </button>
    );
  }

  return (
    <form action={purgarAuditoriaAction} className="w-full max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
      <input type="hidden" name="hasta" value={hasta} />
      <input type="hidden" name="acepta" value={acepta ? "on" : ""} />
      <input type="hidden" name="confirm_frase" value={frase} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Punto n={1} paso={paso} /><span className="h-px w-4 bg-red-300" /><Punto n={2} paso={paso} />
        </div>
        <button type="button" onClick={cerrar} className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">Cancelar</button>
      </div>

      <p className="mb-3 text-sm font-semibold text-red-800 dark:text-red-300">Purgar historial de auditoría</p>

      {paso === 1 ? (
        <div>
          <label htmlFor="purgar-hasta" className="mb-1 block text-xs text-red-700 dark:text-red-300">
            Borrar todo el historial anterior a (máximo hasta hace un año):
          </label>
          <input
            id="purgar-hasta"
            type="date"
            value={hasta}
            max={limiteMaximo}
            onChange={(e) => setHasta(e.target.value)}
            className="w-56 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-sm dark:border-red-900 dark:bg-slate-950 dark:text-slate-100"
          />
          <label className="mt-3 flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
            Entiendo que esto borra <strong>permanentemente</strong> los registros de auditoría anteriores a esa
            fecha, de <strong>todas las empresas</strong> de la plataforma, y que la acción no se puede deshacer.
            La cadena de integridad queda registrada como reiniciada en ese punto, no como rota.
          </label>
          <button type="button" disabled={!acepta || !hasta} onClick={() => setPaso(2)} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
            Continuar (paso 1 de 2)
          </button>
        </div>
      ) : null}

      {paso === 2 ? (
        <div>
          <label htmlFor="purgar-confirm-frase" className="mb-1 block text-xs text-red-700 dark:text-red-300">
            Último paso: escribe <span className="font-mono font-bold">PURGAR</span> para confirmar:
          </label>
          <input
            id="purgar-confirm-frase"
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder="PURGAR"
            autoFocus
            className="w-56 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-sm dark:border-red-900 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPaso(1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">Atrás</button>
            <button type="submit" disabled={frase.trim().toUpperCase() !== "PURGAR"} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
              Purgar definitivamente
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
