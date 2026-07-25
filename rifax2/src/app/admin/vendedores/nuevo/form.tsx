"use client";

import { useActionState } from "react";
import { crearVendedorAction, type VendedorFormState } from "../actions";

const initialState: VendedorFormState = {};

const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const etiqueta = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function FormVendedor() {
  const [state, action, pending] = useActionState(crearVendedorAction, initialState);

  return (
    <form
      action={action}
      className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <label htmlFor="nombre" className={etiqueta}>
          Nombre completo
        </label>
        <input id="nombre" name="nombre" required minLength={3} className={campo} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="documento" className={etiqueta}>
            Documento
          </label>
          <input id="documento" name="documento" required minLength={3} className={campo} />
        </div>
        <div>
          <label htmlFor="telefono" className={etiqueta}>
            Teléfono
          </label>
          <input id="telefono" name="telefono" required minLength={7} className={campo} />
        </div>
      </div>

      <div>
        <label htmlFor="correo" className={etiqueta}>
          Correo <span className="text-zinc-400">(opcional)</span>
        </label>
        <input id="correo" name="correo" type="email" className={campo} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pct_comision" className={etiqueta}>
            Comisión % <span className="text-zinc-400">(opcional)</span>
          </label>
          <input
            id="pct_comision"
            name="pct_comision"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            className={campo}
          />
        </div>
        <div>
          <label htmlFor="cupo_max" className={etiqueta}>
            Cupo máx. de boletas <span className="text-zinc-400">(opcional)</span>
          </label>
          <input
            id="cupo_max"
            name="cupo_max"
            type="number"
            min="1"
            step="1"
            placeholder="Sin límite"
            className={campo}
          />
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
        className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear vendedor"}
      </button>
    </form>
  );
}
