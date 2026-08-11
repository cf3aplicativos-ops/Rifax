"use client";

import { useActionState, useState } from "react";
import { crearSedeAction, type SedeFormState } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: SedeFormState = {};

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function FormSede(_props: { action?: unknown }) {
  const [state, action, pending] = useActionState(crearSedeAction, initialState);
  const [conAdmin, setConAdmin] = useState(false);

  return (
    <form
      action={action}
      className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nueva sede</h2>
      <div>
        <label htmlFor="nombre" className={etiqueta}>Nombre de la sede</label>
        <input id="nombre" name="nombre" autoFocus required minLength={2} placeholder="Ej: Sede Centro" className={campo} />
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

      <fieldset className="space-y-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={conAdmin} onChange={(e) => setConAdmin(e.target.checked)} className="rounded" />
          Crear un administrador propio para esta sede
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tendrá el mismo rol de administrador, pero acotado a esta sede: gestiona sus propias rifas, ventas y
          cartera de forma independiente. El administrador general de la empresa sigue viendo todas las sedes.
        </p>
        {conAdmin ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin_nombre" className={etiqueta}>Nombre del administrador</label>
              <input id="admin_nombre" name="admin_nombre" required={conAdmin} minLength={3} className={campo} />
            </div>
            <div>
              <label htmlFor="admin_correo" className={etiqueta}>Correo</label>
              <input id="admin_correo" name="admin_correo" type="email" required={conAdmin} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="admin_password" className={etiqueta}>Contraseña inicial</label>
              <PasswordInput name="admin_password" autoComplete="new-password" minLength={8} required={conAdmin} />
            </div>
          </div>
        ) : null}
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
