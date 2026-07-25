"use client";

import { useActionState } from "react";
import { crearSedeAction, type SedeFormState } from "../actions";

const initialState: SedeFormState = {};

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function FormSede(_props: { action?: unknown }) {
  const [state, action, pending] = useActionState(crearSedeAction, initialState);

  return (
    <form
      action={action}
      className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nueva sede</h2>
      <div>
        <label htmlFor="nombre" className={etiqueta}>Nombre de la sede</label>
        <input id="nombre" name="nombre" required minLength={2} placeholder="Ej: Sede Centro" className={campo} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="direccion" className={etiqueta}>Dirección <span className="text-slate-400">(opcional)</span></label>
          <input id="direccion" name="direccion" className={campo} />
        </div>
        <div>
          <label htmlFor="telefono" className={etiqueta}>Teléfono <span className="text-slate-400">(opcional)</span></label>
          <input id="telefono" name="telefono" className={campo} />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear sede"}
      </button>
    </form>
  );
}
