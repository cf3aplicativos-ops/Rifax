"use client";

import { useActionState } from "react";
import { cambiarPasswordAction, type UsuarioFormState } from "../usuarios/actions";

const initialState: UsuarioFormState = {};

const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const etiqueta = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function FormPassword() {
  const [state, action, pending] = useActionState(cambiarPasswordAction, initialState);

  return (
    <form
      action={action}
      className="mt-4 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <label htmlFor="actual" className={etiqueta}>
          Contraseña actual
        </label>
        <input
          id="actual"
          name="actual"
          type="password"
          required
          autoComplete="current-password"
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="nueva" className={etiqueta}>
          Nueva contraseña
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={campo}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Mínimo 8 caracteres. Al cambiarla se cerrarán todas tus sesiones y deberás
          volver a entrar.
        </p>
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
        {pending ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
