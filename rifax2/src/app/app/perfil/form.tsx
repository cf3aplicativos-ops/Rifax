"use client";

import { useActionState } from "react";
import { cambiarPasswordAction, type UsuarioFormState } from "../usuarios/actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: UsuarioFormState = {};
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function FormPassword() {
  const [state, action, pending] = useActionState(cambiarPasswordAction, initialState);
  return (
    <form action={action} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label htmlFor="actual" className={etiqueta}>Contraseña actual</label>
        <PasswordInput name="actual" id="actual" autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="nueva" className={etiqueta}>Nueva contraseña</label>
        <PasswordInput name="nueva" id="nueva" autoComplete="new-password" minLength={8} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mínimo 8 caracteres. Se cerrarán todas tus sesiones.</p>
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
